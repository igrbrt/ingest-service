import { Module } from '@nestjs/common';
import { SystemClock } from '@/common/clock/system-clock.js';
import { AppConstants } from '@/app.constants.js';
import { AppConfigModule } from '@/config/app-config.module.js';
import { EventsModule } from '@/events/events.module.js';
import { QueueModule } from '@/queue/queue.module.js';
import { ReconcilerService } from '@/reconciliation/reconciler.service.js';

@Module({
  imports: [AppConfigModule, EventsModule, QueueModule],
  providers: [
    ReconcilerService,
    { provide: AppConstants.CLOCK_TOKEN, useClass: SystemClock },
  ],
})
export class ReconciliationModule {}
