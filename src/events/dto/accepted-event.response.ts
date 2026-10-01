import type { PatientEventStatus } from '@prisma/client';

export interface AcceptedEventResponse {
  id: string;
  patientId: string;
  type: string;
  occurredAt: string;
  status: PatientEventStatus;
  idempotencyKey: string;
  receivedAt: string;
}
