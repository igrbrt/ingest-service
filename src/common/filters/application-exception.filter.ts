import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { ApplicationException } from '@/common/errors/application.exception.js';
import type { ErrorResponse } from '@/common/errors/error-response.js';
import type { CorrelatedRequest } from '@/common/http/correlated-request.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import { applicationMessages } from '@/common/messages/application-messages.js';

@Catch()
export class ApplicationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApplicationExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<CorrelatedRequest>();
    const response = http.getResponse<{
      status(code: number): { json(body: ErrorResponse): void };
    }>();
    
    const code =
      exception instanceof ApplicationException
        ? exception.code
        : ApplicationCode.INTERNAL_ERROR;

    if (!(exception instanceof ApplicationException)) {
      const name = exception instanceof Error ? exception.name : 'UnknownError';
      this.logger.error(`Unhandled ${name}`);
    }

    const definition = applicationMessages[code];
    const body: ErrorResponse = {
      statusCode: definition.httpStatus,
      code,
      message: definition.message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      correlationId: request.correlationId ?? 'unavailable',
    };

    response.status(definition.httpStatus).json(body);
  }
}
