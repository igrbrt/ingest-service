import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ApplicationExceptionFilter } from './common/filters/application-exception.filter.js';
import { ApiKeyGuard } from './common/guards/api-key.guard.js';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor.js';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: ApplicationExceptionFilter },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
  ],
})
export class AppModule {}
