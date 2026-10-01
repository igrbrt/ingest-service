import { PatientEventStatus, type PatientEvent } from '@prisma/client';
import { ApplicationException } from '@/common/errors/application.exception.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import type { PatientEventService } from '@/events/patient-event.service.js';
import type { PatientQueueProducer } from '@/queue/patient-queue.producer.js';
import { AdminService } from '@/admin/admin.service.js';

function deadLetter(id: string): PatientEvent {
  return {
    id,
    patientId: 'patient-1',
    type: 'observation',
    data: { note: 'review' },
    occurredAt: new Date('2026-10-01T10:00:00.000Z'),
    idempotencyKey: id,
    receivedAt: new Date('2026-10-01T10:00:01.000Z'),
    processedAt: null,
    createdAt: new Date('2026-10-01T10:00:01.000Z'),
    status: PatientEventStatus.DEAD_LETTER,
    processingResult: null,
    attemptCount: 5,
    nextRetryAt: null,
    lastErrorCode: 'PROCESSING_FAILED',
    leaseOwner: null,
    leaseUntil: null,
  };
}

describe('AdminService', () => {
  it('lists dead letters and reprocesses the same event', async () => {
    const original = deadLetter('aaaaaaaaaaaaaaaaaaaaaaaa');
    const reset = {
      ...original,
      status: PatientEventStatus.PENDING,
      attemptCount: 0,
    };
    const events = {
      listDeadLetterPatientEvents: vi.fn(async () => [original]),
      findPatientEventById: vi.fn(async () => original),
      resetDeadLetterPatientEvent: vi.fn(async () => reset),
    };
    const enqueuePatient = vi.fn(async () => undefined);
    const service = new AdminService(
      events as unknown as PatientEventService,
      { enqueuePatient } as unknown as PatientQueueProducer,
    );
    const listed = await service.listDeadLetterEvents();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.lastErrorCode).toBe('PROCESSING_FAILED');
    const accepted = await service.reprocessDeadLetterEvent(original.id);
    expect(accepted.id).toBe(original.id);
    expect(accepted.status).toBe(PatientEventStatus.PENDING);
    expect(enqueuePatient).toHaveBeenCalledWith({ patientId: 'patient-1' });
    expect(events.resetDeadLetterPatientEvent).toHaveBeenCalledWith(
      original.id,
    );
  });

  it('refuses to reprocess an event that is not dead-lettered', async () => {
    const pending = {
      ...deadLetter('bbbbbbbbbbbbbbbbbbbbbbbb'),
      status: PatientEventStatus.PENDING,
    };
    const service = new AdminService(
      {
        findPatientEventById: vi.fn(async () => pending),
        resetDeadLetterPatientEvent: vi.fn(),
      } as unknown as PatientEventService,
      { enqueuePatient: vi.fn() } as unknown as PatientQueueProducer,
    );
    await expect(service.reprocessDeadLetterEvent(pending.id)).rejects.toEqual(
      new ApplicationException(ApplicationCode.EVENT_NOT_REPROCESSABLE),
    );
  });

  it('returns not found for an unknown event', async () => {
    const service = new AdminService(
      {
        findPatientEventById: vi.fn(async () => null),
      } as unknown as PatientEventService,
      { enqueuePatient: vi.fn() } as unknown as PatientQueueProducer,
    );
    await expect(
      service.reprocessDeadLetterEvent('cccccccccccccccccccccccc'),
    ).rejects.toEqual(
      new ApplicationException(ApplicationCode.EVENT_NOT_FOUND),
    );
  });
});
