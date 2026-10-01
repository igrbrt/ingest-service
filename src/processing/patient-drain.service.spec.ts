import { PatientEventStatus, Prisma, type PatientEvent } from '@prisma/client';
import type { Clock } from '@/common/clock/clock.js';
import type { AppConfig } from '@/config/app-config.js';
import type { PatientEventService } from '@/events/patient-event.service.js';
import type { PatientQueueProducer } from '@/queue/patient-queue.producer.js';
import type { ExternalProcessor } from '@/processing/interface/external-processor.js';
import type { PatientLockPort } from '@/processing/interface/patient-lock.port.js';
import { PatientDrainService } from '@/processing/patient-drain.service.js';
import { ProcessingRuntime } from '@/processing/processing-runtime.js';

const start = new Date('2026-10-01T12:00:00.000Z');

class ManualClock implements Clock {
  constructor(private current = new Date(start)) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

class MemoryLock implements PatientLockPort {
  private readonly owners = new Map<string, string>();

  async acquire(input: {
    patientId: string;
    owner: string;
    ttlMs: number;
  }): Promise<boolean> {
    if (this.owners.has(input.patientId)) {
      return false;
    }

    this.owners.set(input.patientId, input.owner);

    return true;
  }

  async extend(input: {
    patientId: string;
    owner: string;
    ttlMs: number;
  }): Promise<boolean> {
    return this.owners.get(input.patientId) === input.owner;
  }

  async release(input: { patientId: string; owner: string }): Promise<void> {
    if (this.owners.get(input.patientId) === input.owner) {
      this.owners.delete(input.patientId);
    }
  }
}

class MemoryPatientEvents {
  readonly events: PatientEvent[] = [];

  async releaseExpiredPatientEventLeases(input: {
    now: Date;
    patientId?: string;
  }): Promise<number> {
    let released = 0;
    for (const event of this.events) {
      if (input.patientId && event.patientId !== input.patientId) {
        continue;
      }

      if (
        event.status === PatientEventStatus.PROCESSING &&
        event.leaseUntil &&
        event.leaseUntil.getTime() < input.now.getTime()
      ) {
        event.status = PatientEventStatus.PENDING;
        event.leaseOwner = null;
        event.leaseUntil = null;
        released += 1;
      }
    }

    return released;
  }

  async findOldestOpenPatientEvent(
    patientId: string,
  ): Promise<PatientEvent | null> {
    const open = this.events
      .filter(
        (event) =>
          event.patientId === patientId &&
          (event.status === PatientEventStatus.PENDING ||
            event.status === PatientEventStatus.PROCESSING ||
            event.status === PatientEventStatus.DEAD_LETTER),
      )
      .sort((left, right) => {
        const byTime = left.occurredAt.getTime() - right.occurredAt.getTime();
        return byTime === 0 ? left.id.localeCompare(right.id) : byTime;
      });

    return open[0] ?? null;
  }

  async findLatestProcessedPatientEvent(
    patientId: string,
  ): Promise<PatientEvent | null> {
    const processed = this.events
      .filter(
        (event) =>
          event.patientId === patientId &&
          event.status === PatientEventStatus.PROCESSED,
      )
      .sort(
        (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
      );

    return processed[0] ?? null;
  }

  async claimPatientEvent(input: {
    id: string;
    owner: string;
    leaseUntil: Date;
  }): Promise<boolean> {
    const event = this.events.find((item) => item.id === input.id);

    if (!event || event.status !== PatientEventStatus.PENDING) {
      return false;
    }

    event.status = PatientEventStatus.PROCESSING;
    event.leaseOwner = input.owner;
    event.leaseUntil = input.leaseUntil;

    return true;
  }

  async completePatientEvent(input: {
    id: string;
    owner: string;
    processedAt: Date;
    result: Prisma.InputJsonObject;
  }): Promise<boolean> {
    const event = this.events.find((item) => item.id === input.id);

    if (
      !event ||
      event.status !== PatientEventStatus.PROCESSING ||
      event.leaseOwner !== input.owner
    ) {
      return false;
    }
    event.status = PatientEventStatus.PROCESSED;
    event.processedAt = input.processedAt;
    event.processingResult = input.result;
    event.leaseOwner = null;
    event.leaseUntil = null;
    return true;
  }

  async schedulePatientEventRetry(input: {
    id: string;
    owner: string;
    attemptCount: number;
    nextRetryAt: Date;
    errorCode: string;
  }): Promise<boolean> {
    const event = this.events.find((item) => item.id === input.id);

    if (
      !event ||
      event.status !== PatientEventStatus.PROCESSING ||
      event.leaseOwner !== input.owner
    ) {
      return false;
    }

    event.status = PatientEventStatus.PENDING;
    event.attemptCount = input.attemptCount;
    event.nextRetryAt = input.nextRetryAt;
    event.lastErrorCode = input.errorCode;
    event.leaseOwner = null;
    event.leaseUntil = null;

    return true;
  }

  async movePatientEventToDeadLetter(input: {
    id: string;
    owner: string;
    attemptCount: number;
    errorCode: string;
  }): Promise<boolean> {
    const event = this.events.find((item) => item.id === input.id);

    if (
      !event ||
      event.status !== PatientEventStatus.PROCESSING ||
      event.leaseOwner !== input.owner
    ) {
      return false;
    }

    event.status = PatientEventStatus.DEAD_LETTER;
    event.attemptCount = input.attemptCount;
    event.lastErrorCode = input.errorCode;
    event.nextRetryAt = null;
    event.leaseOwner = null;
    event.leaseUntil = null;
    return true;
  }

  async markPatientEventForReconciliation(id: string): Promise<boolean> {
    const event = this.events.find(
      (item) => item.id === id && item.status === PatientEventStatus.PENDING,
    );

    if (!event) {
      return false;
    }

    event.status = PatientEventStatus.RECONCILIATION_REQUIRED;
    return true;
  }

  async findEligiblePendingPatientEvents(input: {
    now: Date;
    reorderWindowMs: number;
    limit: number;
    patientId?: string;
  }): Promise<PatientEvent[]> {
    const eligibleBefore = input.now.getTime() - input.reorderWindowMs;

    return this.events
      .filter((event) => {
        if (event.status !== PatientEventStatus.PENDING) {
          return false;
        }
        if (input.patientId && event.patientId !== input.patientId) {
          return false;
        }
        if (event.receivedAt.getTime() > eligibleBefore) {
          return false;
        }
        if (
          event.nextRetryAt &&
          event.nextRetryAt.getTime() > input.now.getTime()
        ) {
          return false;
        }
        return true;
      })
      .slice(0, input.limit);
  }
}

function createEvent(input: {
  id: string;
  patientId: string;
  occurredAt: Date;
  receivedAt: Date;
  status?: PatientEventStatus;
  attemptCount?: number;
  nextRetryAt?: Date | null;
  leaseUntil?: Date | null;
  leaseOwner?: string | null;
}): PatientEvent {
  return {
    id: input.id,
    patientId: input.patientId,
    type: 'observation',
    data: { hidden: true },
    occurredAt: input.occurredAt,
    idempotencyKey: input.id,
    receivedAt: input.receivedAt,
    processedAt: null,
    createdAt: input.receivedAt,
    status: input.status ?? PatientEventStatus.PENDING,
    processingResult: null,
    attemptCount: input.attemptCount ?? 0,
    nextRetryAt: input.nextRetryAt ?? null,
    lastErrorCode: null,
    leaseOwner: input.leaseOwner ?? null,
    leaseUntil: input.leaseUntil ?? null,
  };
}

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    port: 3000,
    databaseUrl: 'mongodb://localhost:27017/ingest',
    redisHost: 'localhost',
    redisPort: 6379,
    ingestApiKey: 'test-ingest-key',
    adminApiKey: 'test-admin-key',
    processingDelayMs: 0,
    reorderWindowMs: 0,
    workerConcurrency: 100,
    maxAttempts: 3,
    retryBaseDelayMs: 1000,
    leaseMs: 30000,
    reconcilerIntervalMs: 5000,
    ...overrides,
  };
}

function createDrain(input: {
  events: MemoryPatientEvents;
  clock: ManualClock;
  processor: ExternalProcessor;
  config?: AppConfig;
}): PatientDrainService {
  return new PatientDrainService(
    input.events as unknown as PatientEventService,
    new MemoryLock(),
    {
      enqueuePatient: vi.fn(async () => undefined),
    } as unknown as PatientQueueProducer,
    new ProcessingRuntime(
      input.config ?? createConfig(),
      input.clock,
      input.processor,
    ),
  );
}

describe('PatientDrainService', () => {
  it('applies one patient in occurredAt order and different patients in parallel', async () => {
    const events = new MemoryPatientEvents();
    const clock = new ManualClock();
    const receivedAt = new Date(start.getTime() - 1000);

    events.events.push(
      createEvent({
        id: '000000000000000000000002',
        patientId: 'patient-a',
        occurredAt: new Date('2026-10-01T10:05:00.000Z'),
        receivedAt,
      }),
      createEvent({
        id: '000000000000000000000001',
        patientId: 'patient-a',
        occurredAt: new Date('2026-10-01T10:00:00.000Z'),
        receivedAt,
      }),
      createEvent({
        id: '000000000000000000000003',
        patientId: 'patient-b',
        occurredAt: new Date('2026-10-01T09:00:00.000Z'),
        receivedAt,
      }),
    );

    const applied: string[] = [];
    let active = 0;
    let maxActive = 0;

    const processor: ExternalProcessor = {
      async applyEvent(input) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
        applied.push(`${input.patientId}:${input.occurredAt.toISOString()}`);
        active -= 1;
        return { outcome: 'accepted' };
      },
    };

    const drain = createDrain({ events, clock, processor });

    await Promise.all([
      drain.drainPatient({ patientId: 'patient-a' }),
      drain.drainPatient({ patientId: 'patient-b' }),
    ]);

    expect(applied.filter((item) => item.startsWith('patient-a'))).toEqual([
      'patient-a:2026-10-01T10:00:00.000Z',
      'patient-a:2026-10-01T10:05:00.000Z',
    ]);

    expect(maxActive).toBe(2);
  });

  it('waits for the reorder window and keeps late events for reconciliation', async () => {
    const events = new MemoryPatientEvents();
    const clock = new ManualClock();
    const processorCalls: string[] = [];

    const processor: ExternalProcessor = {
      async applyEvent(input) {
        processorCalls.push(input.idempotencyKey);
        return { outcome: 'accepted' };
      },
    };

    events.events.push(
      createEvent({
        id: '000000000000000000000010',
        patientId: 'patient-a',
        occurredAt: new Date('2026-10-01T11:00:00.000Z'),
        receivedAt: start,
      }),
    );

    const drain = createDrain({
      events,
      clock,
      processor,
      config: createConfig({ reorderWindowMs: 15000 }),
    });

    await drain.drainPatient({ patientId: 'patient-a' });

    expect(processorCalls).toEqual([]);
    expect(events.events[0]?.status).toBe(PatientEventStatus.PENDING);

    clock.advance(15000);

    await drain.drainPatient({ patientId: 'patient-a' });
    expect(processorCalls).toEqual(['000000000000000000000010']);

    events.events.push(
      createEvent({
        id: '000000000000000000000011',
        patientId: 'patient-a',
        occurredAt: new Date('2026-10-01T10:00:00.000Z'),
        receivedAt: new Date(clock.now().getTime() - 20000),
      }),
      createEvent({
        id: '000000000000000000000012',
        patientId: 'patient-a',
        occurredAt: new Date('2026-10-01T12:00:00.000Z'),
        receivedAt: new Date(clock.now().getTime() - 20000),
      }),
    );

    await drain.drainPatient({ patientId: 'patient-a' });

    expect(processorCalls).toEqual([
      '000000000000000000000010',
      '000000000000000000000012',
    ]);

    expect(events.events.find((event) => event.id.endsWith('11'))?.status).toBe(
      PatientEventStatus.RECONCILIATION_REQUIRED,
    );
  });

  it('retries with backoff and then dead-letters without advancing later events', async () => {
    const events = new MemoryPatientEvents();
    const clock = new ManualClock();

    events.events.push(
      createEvent({
        id: '000000000000000000000020',
        patientId: 'patient-a',
        occurredAt: new Date('2026-10-01T10:00:00.000Z'),
        receivedAt: new Date(start.getTime() - 1000),
      }),
      createEvent({
        id: '000000000000000000000021',
        patientId: 'patient-a',
        occurredAt: new Date('2026-10-01T10:05:00.000Z'),
        receivedAt: new Date(start.getTime() - 1000),
      }),
    );

    const processor: ExternalProcessor = {
      async applyEvent() {
        throw new Error('external down');
      },
    };

    const drain = createDrain({ events, clock, processor });
    await drain.drainPatient({ patientId: 'patient-a' });

    expect(events.events[0]).toMatchObject({
      status: PatientEventStatus.PENDING,
      attemptCount: 1,
      lastErrorCode: 'PROCESSING_FAILED',
    });

    expect(events.events[0]?.nextRetryAt?.toISOString()).toBe(
      new Date(start.getTime() + 1000).toISOString(),
    );

    expect(events.events[1]?.status).toBe(PatientEventStatus.PENDING);

    await drain.drainPatient({ patientId: 'patient-a' });
    expect(events.events[0]?.attemptCount).toBe(1);

    clock.advance(1000);

    await drain.drainPatient({ patientId: 'patient-a' });
    expect(events.events[0]?.attemptCount).toBe(2);

    clock.advance(2000);

    await drain.drainPatient({ patientId: 'patient-a' });
    expect(events.events[0]).toMatchObject({
      status: PatientEventStatus.DEAD_LETTER,
      attemptCount: 3,
      lastErrorCode: 'PROCESSING_FAILED',
    });

    expect(events.events[1]?.status).toBe(PatientEventStatus.PENDING);
    expect(events.events[1]?.attemptCount).toBe(0);
  });

  it('recovers an expired processing lease and applies the event once', async () => {
    const events = new MemoryPatientEvents();
    const clock = new ManualClock();

    events.events.push(
      createEvent({
        id: '000000000000000000000030',
        patientId: 'patient-a',
        occurredAt: new Date('2026-10-01T10:00:00.000Z'),
        receivedAt: new Date(start.getTime() - 1000),
        status: PatientEventStatus.PROCESSING,
        leaseOwner: 'crashed-worker',
        leaseUntil: new Date(start.getTime() - 1),
      }),
    );

    const applied: string[] = [];
    const processor: ExternalProcessor = {
      async applyEvent(input) {
        applied.push(input.idempotencyKey);
        return { outcome: 'accepted' };
      },
    };
    const drain = createDrain({ events, clock, processor });
    await drain.drainPatient({ patientId: 'patient-a' });
    
    expect(applied).toEqual(['000000000000000000000030']);
    expect(events.events[0]?.status).toBe(PatientEventStatus.PROCESSED);
    expect(events.events[0]?.leaseOwner).toBeNull();
  });
});
