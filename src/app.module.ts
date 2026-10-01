import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AdminModule } from '@/admin/admin.module.js';
import { ApplicationExceptionFilter } from '@/common/filters/application-exception.filter.js';
import { ApiKeyGuard } from '@/common/guards/api-key.guard.js';
import { CorrelationIdInterceptor } from '@/common/interceptors/correlation-id.interceptor.js';
import { AppConfigModule } from '@/config/app-config.module.js';
import { EventsModule } from '@/events/events.module.js';
import { HealthModule } from '@/health/health.module.js';

@Module({
  imports: [AppConfigModule, EventsModule, HealthModule, AdminModule],
  providers: [
    { provide: APP_FILTER, useClass: ApplicationExceptionFilter },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
  ],
})
export class AppModule {}
