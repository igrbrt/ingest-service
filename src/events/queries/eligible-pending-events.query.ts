import { PatientEventStatus, type Prisma } from '@prisma/client';

export function buildEligiblePendingEventsQuery(input: {
  now: Date;
  reorderWindowMs: number;
  limit: number;
  patientId?: string;
}): Prisma.PatientEventFindManyArgs {
  const eligibleBefore = new Date(input.now.getTime() - input.reorderWindowMs);
  return {
    where: {
      status: PatientEventStatus.PENDING,
      receivedAt: { lte: eligibleBefore },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: input.now } }],
      ...(input.patientId ? { patientId: input.patientId } : {}),
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    take: input.limit,
  };
}
