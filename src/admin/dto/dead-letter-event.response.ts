import { Prisma, type PatientEventStatus } from '@prisma/client';

export interface DeadLetterEventResponse {
  id: string;
  patientId: string;
  type: string;
  data: Prisma.JsonValue;
  occurredAt: string;
  receivedAt: string;
  attemptCount: number;
  lastErrorCode: string | null;
  status: PatientEventStatus;
}
