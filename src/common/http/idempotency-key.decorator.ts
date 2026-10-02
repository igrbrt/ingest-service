import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { AppConstants } from '@/app.constants.js';
import { ApplicationException } from '@/common/errors/application.exception.js';
import type { CorrelatedRequest } from '@/common/http/correlated-request.js';
import { IDEMPOTENCY_KEY_HEADER } from '@/common/http/http-headers.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import { readSingleHeader } from '@/common/utils/helper.js';

export function readIdempotencyKey(
  value: string | string[] | undefined,
): string | undefined {
  const header = readSingleHeader(value)?.trim();

  if (!header) {
    return undefined;
  }

  if (header.length > AppConstants.MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new ApplicationException(ApplicationCode.VALIDATION_FAILED);
  }

  return header;
}

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<CorrelatedRequest>();

    return readIdempotencyKey(request.headers[IDEMPOTENCY_KEY_HEADER]);
  },
);
