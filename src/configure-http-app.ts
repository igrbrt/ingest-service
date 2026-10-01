import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { ApplicationException } from '@/common/errors/application.exception.js';
import type { CorrelatedRequest } from '@/common/http/correlated-request.js';
import { CORRELATION_ID_HEADER } from '@/common/http/http-headers.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import { readSingleHeader } from '@/common/utils/helper.js';

export function configureHttpApp(app: INestApplication): void {
  app.enableShutdownHooks();
  
  app.use(
    (request: CorrelatedRequest, response: Response, next: NextFunction) => {
      const incoming = readSingleHeader(request.header(CORRELATION_ID_HEADER));
      const correlationId =
        incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
      request.correlationId = correlationId;
      response.setHeader(CORRELATION_ID_HEADER, correlationId);
      next();
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (): ApplicationException =>
        new ApplicationException(ApplicationCode.VALIDATION_FAILED),
    }),
  );
}
