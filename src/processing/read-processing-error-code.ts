import { ApplicationException } from '../common/errors/application.exception.js';
import { ApplicationCode } from '../common/messages/application-code.js';

export function readProcessingErrorCode(error: unknown): string {
  if (error instanceof ApplicationException) {
    return error.code;
  }
  return ApplicationCode.PROCESSING_FAILED;
}
