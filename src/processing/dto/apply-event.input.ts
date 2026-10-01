import { Prisma } from '@prisma/client';

export interface ApplyEventInput {
  idempotencyKey: string;
  patientId: string;
  type: string;
  data: Prisma.JsonValue;
  occurredAt: Date;
}
