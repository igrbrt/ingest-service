import { Prisma } from '@prisma/client';
import { ApplicationException } from '../../common/errors/application.exception.js';
import { ApplicationCode } from '../../common/messages/application-code.js';

export function toJsonObject(
  value: Record<string, unknown>,
): Prisma.InputJsonObject {
  const serialized: unknown = JSON.parse(JSON.stringify(value));
  if (
    serialized === null ||
    typeof serialized !== 'object' ||
    Array.isArray(serialized)
  ) {
    throw new ApplicationException(ApplicationCode.VALIDATION_FAILED);
  }
  return serialized as Prisma.InputJsonObject;
}
