export function computeNextRetryAt(input: {
  attemptCount: number;
  baseDelayMs: number;
  now: Date;
}): Date {
  const exponent = Math.max(input.attemptCount - 1, 0);
  return new Date(input.now.getTime() + input.baseDelayMs * 2 ** exponent);
}
