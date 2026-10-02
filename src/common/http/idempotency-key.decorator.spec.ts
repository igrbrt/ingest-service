import { ApplicationException } from '@/common/errors/application.exception.js';
import { readIdempotencyKey } from '@/common/http/idempotency-key.decorator.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import { AppConstants } from '@/app.constants.js';

describe('readIdempotencyKey', () => {
  it('returns a trimmed header', () => {
    expect(readIdempotencyKey('  client-key  ')).toBe('client-key');
    expect(readIdempotencyKey(['  first  ', 'second'])).toBe('first');
  });

  it('returns undefined when the header is missing or blank', () => {
    expect(readIdempotencyKey(undefined)).toBeUndefined();
    expect(readIdempotencyKey('   ')).toBeUndefined();
    expect(readIdempotencyKey([''])).toBeUndefined();
  });

  it('rejects a header longer than the maximum', () => {
    const header = 'k'.repeat(AppConstants.MAX_IDEMPOTENCY_KEY_LENGTH + 1);

    expect(() => readIdempotencyKey(header)).toThrow(
      new ApplicationException(ApplicationCode.VALIDATION_FAILED),
    );
  });
});
