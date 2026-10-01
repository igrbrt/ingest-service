import { createHash } from 'node:crypto';
import { buildIdempotencyKey } from './build-idempotency-key.js';
import { canonicalize } from './canonicalize.js';

describe('buildIdempotencyKey', () => {
  const payload = {
    patientId: 'patient-1',
    type: 'observation',
    data: { b: 1, a: { z: true, y: [2, 1] } },
    ts: '2026-10-01T12:00:00.000Z',
  };

  it('prefers a non-empty idempotency header', () => {
    expect(
      buildIdempotencyKey({ headerValue: '  client-key  ', payload }),
    ).toBe('client-key');
  });

  it('hashes a canonical payload when the header is absent', () => {
    const expected = createHash('sha256')
      .update(canonicalize(payload))
      .digest('hex');
    expect(buildIdempotencyKey({ headerValue: '   ', payload })).toBe(expected);
    expect(buildIdempotencyKey({ headerValue: undefined, payload })).toBe(
      expected,
    );
  });

  it('ignores object key order in the canonical hash', () => {
    const reordered = {
      ts: payload.ts,
      data: { a: { y: [2, 1], z: true }, b: 1 },
      type: payload.type,
      patientId: payload.patientId,
    };
    expect(canonicalize(payload)).toBe(canonicalize(reordered));
  });
});
