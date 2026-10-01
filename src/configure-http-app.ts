import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ApplicationException } from './common/errors/application.exception.js';
import { ApplicationCode } from './common/messages/application-code.js';

export function configureHttpApp(app: INestApplication): void {
  app.enableShutdownHooks();
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
