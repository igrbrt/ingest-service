import { createHash } from 'node:crypto';
import type { CanonicalEventPayload } from './canonical-event-payload.js';
import { canonicalize } from './canonicalize.js';

export function buildIdempotencyKey(input: {
  headerValue: string | undefined;
  payload: CanonicalEventPayload;
}): string {
  const header = input.headerValue?.trim();
  if (header) {
    return header;
  }
  return createHash('sha256').update(canonicalize(input.payload)).digest('hex');
}
