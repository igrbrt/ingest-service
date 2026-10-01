import { HttpStatus } from '@nestjs/common';
import { ApplicationCode } from './application-code.js';
import type { ApplicationCode as ApplicationCodeValue } from './application-code.type.js';
import type { ApplicationMessage } from './application-message.js';

export const applicationMessages: Record<
  ApplicationCodeValue,
  ApplicationMessage
> = {
  [ApplicationCode.UNAUTHORIZED]: {
    httpStatus: HttpStatus.UNAUTHORIZED,
    message: 'API key is missing or invalid',
  },
  [ApplicationCode.VALIDATION_FAILED]: {
    httpStatus: HttpStatus.BAD_REQUEST,
    message: 'Request validation failed',
  },
  [ApplicationCode.SERVICE_UNAVAILABLE]: {
    httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'The service is temporarily unavailable',
  },
  [ApplicationCode.EVENT_NOT_FOUND]: {
    httpStatus: HttpStatus.NOT_FOUND,
    message: 'Patient event was not found',
  },
  [ApplicationCode.EVENT_NOT_REPROCESSABLE]: {
    httpStatus: HttpStatus.CONFLICT,
    message: 'Only dead-letter events can be reprocessed',
  },
  [ApplicationCode.PROCESSING_FAILED]: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Event processing failed',
  },
  [ApplicationCode.INTERNAL_ERROR]: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'An unexpected error occurred',
  },
};
