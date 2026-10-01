import { PatientEventStatus } from '@prisma/client';
import { buildEligiblePendingEventsQuery } from '@/events/queries/eligible-pending-events.query.js';

describe('buildEligiblePendingEventsQuery', () => {
  it('includes documents whose retry timestamp was never stored', () => {
    const now = new Date('2026-10-01T12:00:20.000Z');
    const query = buildEligiblePendingEventsQuery({
      now,
      reorderWindowMs: 15_000,
      limit: 500,
    });

    expect(query.where).toEqual({
      status: PatientEventStatus.PENDING,
      receivedAt: { lte: new Date('2026-10-01T12:00:05.000Z') },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { isSet: false } },
        { nextRetryAt: { lte: now } },
      ],
    });
    expect(query.take).toBe(500);
  });
});
