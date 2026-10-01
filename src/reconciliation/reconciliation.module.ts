import { Module } from '@nestjs/common';
import { CLOCK } from '../common/clock/clock.token.js';
import { SystemClock } from '../common/clock/system-clock.js';
import { AppConfigModule } from '../config/app-config.module.js';
import { EventsModule } from '../events/events.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { ReconcilerService } from './reconciler.service.js';

@Module({
  imports: [AppConfigModule, EventsModule, QueueModule],
  providers: [ReconcilerService, { provide: CLOCK, useClass: SystemClock }],
})
export class ReconciliationModule {}
