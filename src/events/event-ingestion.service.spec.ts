import { Prisma, type PatientEvent } from '@prisma/client';
import type { Clock } from '../common/clock/clock.js';
import { ApplicationException } from '../common/errors/application.exception.js';
import { ApplicationCode } from '../common/messages/application-code.js';
import type { PatientEventService } from './patient-event.service.js';
import { EventIngestionService } from './event-ingestion.service.js';
import type { PatientQueueProducer } from '../queue/patient-queue.producer.js';
import { PatientEventStatus } from '@prisma/client';

class RecordingEvents {
  readonly events: PatientEvent[] = [];
  failCreates = false;

  async createPatientEvent(input: {
    patientId: string;
    type: string;
    data: Prisma.InputJsonObject;
    occurredAt: Date;
    idempotencyKey: string;
    receivedAt: Date;
  }): Promise<PatientEvent> {
    if (this.failCreates) {
      throw new Prisma.PrismaClientInitializationError(
        'database unavailable',
        '6.19.3',
      );
    }
    if (
      this.events.some((event) => event.idempotencyKey === input.idempotencyKey)
    ) {
      throw new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.19.3',
        },
      );
    }
    const event = {
      id: `00000000000000000000000${this.events.length + 1}`,
      patientId: input.patientId,
      type: input.type,
      data: input.data,
      occurredAt: input.occurredAt,
      idempotencyKey: input.idempotencyKey,
      receivedAt: input.receivedAt,
      processedAt: null,
      createdAt: input.receivedAt,
      status: PatientEventStatus.PENDING,
      processingResult: null,
      attemptCount: 0,
      nextRetryAt: null,
      lastErrorCode: null,
      leaseOwner: null,
      leaseUntil: null,
    } as PatientEvent;
    this.events.push(event);
    return event;
  }

  async findPatientEventByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PatientEvent | null> {
    return (
      this.events.find((event) => event.idempotencyKey === idempotencyKey) ??
      null
    );
  }
}

describe('EventIngestionService', () => {
  const body = {
    patientId: 'patient-1',
    type: 'observation',
    data: { a: 1 },
    ts: '2026-10-01T12:00:00.000Z',
  };
  const clock: Clock = { now: () => new Date('2026-10-01T12:00:01.000Z') };

  it('returns one event when duplicate inserts race', async () => {
    const store = new RecordingEvents();
    const enqueuePatient = vi.fn(async () => undefined);
    const service = new EventIngestionService(
      store as unknown as PatientEventService,
      { enqueuePatient } as unknown as PatientQueueProducer,
      clock,
    );
    const [first, second] = await Promise.all([
      service.acceptEvent({ body, idempotencyKey: 'same-key' }),
      service.acceptEvent({ body, idempotencyKey: 'same-key' }),
    ]);
    expect(first.id).toBe(second.id);
    expect(store.events).toHaveLength(1);
    expect(enqueuePatient).toHaveBeenCalledTimes(1);
  });

  it('does not return an acceptance when persistence fails', async () => {
    const store = new RecordingEvents();
    store.failCreates = true;
    const enqueuePatient = vi.fn(async () => undefined);
    const service = new EventIngestionService(
      store as unknown as PatientEventService,
      { enqueuePatient } as unknown as PatientQueueProducer,
      clock,
    );
    await expect(
      service.acceptEvent({ body, idempotencyKey: undefined }),
    ).rejects.toEqual(
      new ApplicationException(ApplicationCode.SERVICE_UNAVAILABLE),
    );
    expect(enqueuePatient).not.toHaveBeenCalled();
  });
});
