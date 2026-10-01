import type { AppConfig } from '../config/app-config.js';
import { DelayedExternalProcessor } from './delayed-external-processor.js';
import { computeNextRetryAt } from './compute-next-retry-at.js';

describe('processing timing', () => {
  it('backs off exponentially', () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    expect(
      computeNextRetryAt({
        attemptCount: 1,
        baseDelayMs: 1000,
        now,
      }).toISOString(),
    ).toBe('2026-10-01T12:00:01.000Z');
    expect(
      computeNextRetryAt({
        attemptCount: 3,
        baseDelayMs: 1000,
        now,
      }).toISOString(),
    ).toBe('2026-10-01T12:00:04.000Z');
  });

  it('waits for the configured external delay', async () => {
    vi.useFakeTimers();
    const processor = new DelayedExternalProcessor({
      processingDelayMs: 5000,
    } as AppConfig);
    const pending = processor.applyEvent({
      idempotencyKey: 'key-1',
      patientId: 'patient-1',
      type: 'observation',
      data: {},
      occurredAt: new Date('2026-10-01T12:00:00.000Z'),
    });
    const expectation = expect(pending).resolves.toEqual({
      outcome: 'accepted',
    });
    await vi.advanceTimersByTimeAsync(4999);
    const raced = await Promise.race([
      pending.then(() => 'settled'),
      Promise.resolve('waiting'),
    ]);
    expect(raced).toBe('waiting');
    await vi.advanceTimersByTimeAsync(1);
    await expectation;
    vi.useRealTimers();
  });
});
