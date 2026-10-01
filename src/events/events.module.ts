import { Module } from '@nestjs/common';
import { CLOCK } from '../common/clock/clock.token.js';
import { SystemClock } from '../common/clock/system-clock.js';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { EventIngestionService } from './event-ingestion.service.js';
import { EventsController } from './events.controller.js';
import { PatientEventService } from './patient-event.service.js';
import { PatientEventRepository } from './repository/patient-event.repository.js';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [EventsController],
  providers: [
    PatientEventRepository,
    PatientEventService,
    EventIngestionService,
    { provide: CLOCK, useClass: SystemClock },
  ],
  exports: [PatientEventService],
})
export class EventsModule {}
