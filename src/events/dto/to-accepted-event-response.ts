import type { PatientEvent } from '@prisma/client';
import type { AcceptedEventResponse } from '../dto/accepted-event.response.js';

export function toAcceptedEventResponse(
  event: PatientEvent,
): AcceptedEventResponse {
  return {
    id: event.id,
    patientId: event.patientId,
    type: event.type,
    occurredAt: event.occurredAt.toISOString(),
    status: event.status,
    idempotencyKey: event.idempotencyKey,
    receivedAt: event.receivedAt.toISOString(),
  };
}
