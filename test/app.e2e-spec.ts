import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PatientEventStatus,
  Prisma,
  type PatientEvent,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { configureHttpApp } from '../src/configure-http-app.js';
import { AppModule } from '../src/app.module.js';
import { PatientEventService } from '../src/events/patient-event.service.js';
import { PatientQueueProducer } from '../src/queue/patient-queue.producer.js';

process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL =
  'mongodb://localhost:27017/ingest?replicaSet=rs0&directConnection=true';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.INGEST_API_KEY = 'test-ingest-key';
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.PROCESSING_DELAY_MS = '0';
process.env.REORDER_WINDOW_MS = '0';
process.env.LEASE_MS = '1000';

const ingestKey = 'test-ingest-key';

class InMemoryPatientEvents {
  readonly events: PatientEvent[] = [];
  failCreates = false;
  private sequence = 0;

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
    const duplicate = this.events.find(
      (event) => event.idempotencyKey === input.idempotencyKey,
    );
    if (duplicate) {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      });
    }
    this.sequence += 1;
    const event: PatientEvent = {
      id: this.sequence.toString(16).padStart(24, '0'),
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
    };
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

describe('Events API (e2e)', () => {
  let app: INestApplication<App>;
  const store = new InMemoryPatientEvents();
  const enqueuePatient = vi.fn(async () => undefined);

  beforeEach(async () => {
    store.events.splice(0, store.events.length);
    store.failCreates = false;
    enqueuePatient.mockClear();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PatientEventService)
      .useValue(store)
      .overrideProvider(PatientQueueProducer)
      .useValue({ enqueuePatient })
      .compile();

    app = moduleFixture.createNestApplication();
    configureHttpApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const payload = {
    patientId: 'patient-1',
    type: 'observation',
    data: { note: 'stable' },
    ts: '2026-10-01T12:00:00.000Z',
  };

  it('rejects a missing API key with the error contract', async () => {
    const response = await request(app.getHttpServer())
      .post('/events')
      .set('X-Correlation-Id', 'corr-1')
      .send(payload)
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'API key is missing or invalid',
      path: '/events',
      correlationId: 'corr-1',
    });
    expect(typeof response.body.timestamp).toBe('string');
    expect(response.headers['x-correlation-id']).toBe('corr-1');
  });

  it('rejects an invalid payload', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .set('X-API-Key', ingestKey)
      .send({ patientId: 'patient-1' })
      .expect(400)
      .expect((response) => {
        expect(response.body.code).toBe('VALIDATION_FAILED');
      });
  });

  it('accepts an event only after it is stored', async () => {
    const response = await request(app.getHttpServer())
      .post('/events')
      .set('X-API-Key', ingestKey)
      .set('Idempotency-Key', 'key-1')
      .send(payload)
      .expect(202);

    expect(response.body).toMatchObject({
      patientId: 'patient-1',
      status: 'PENDING',
      idempotencyKey: 'key-1',
    });
    expect(response.body.data).toBeUndefined();
    expect(store.events).toHaveLength(1);
    expect(enqueuePatient).toHaveBeenCalledWith({ patientId: 'patient-1' });
  });

  it('returns the original event when the same key is submitted again', async () => {
    const first = await request(app.getHttpServer())
      .post('/events')
      .set('X-API-Key', ingestKey)
      .set('Idempotency-Key', 'key-1')
      .send(payload)
      .expect(202);

    const second = await request(app.getHttpServer())
      .post('/events')
      .set('X-API-Key', ingestKey)
      .set('Idempotency-Key', 'key-1')
      .send(payload)
      .expect(202);

    expect(second.body.id).toBe(first.body.id);
    expect(store.events).toHaveLength(1);
    expect(enqueuePatient).toHaveBeenCalledTimes(1);
  });

  it('does not acknowledge an event when persistence fails', async () => {
    store.failCreates = true;
    await request(app.getHttpServer())
      .post('/events')
      .set('X-API-Key', ingestKey)
      .send(payload)
      .expect(503)
      .expect((response) => {
        expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
      });
    expect(store.events).toHaveLength(0);
    expect(enqueuePatient).not.toHaveBeenCalled();
  });
});
