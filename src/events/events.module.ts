import { Module } from '@nestjs/common';
import { SystemClock } from '@/common/clock/system-clock.js';
import { AppConstants } from '@/app.constants.js';
import { CommonModule } from '@/common/common.module.js';
import { QueueModule } from '@/queue/queue.module.js';
import { EventIngestionService } from '@/events/event-ingestion.service.js';
import { EventsController } from '@/events/events.controller.js';
import { PatientEventService } from '@/events/patient-event.service.js';
import { PatientEventRepository } from '@/events/patient-event.repository.js';

@Module({
  imports: [CommonModule, QueueModule],
  controllers: [EventsController],
  providers: [
    PatientEventRepository,
    PatientEventService,
    EventIngestionService,
    { provide: AppConstants.CLOCK_TOKEN, useClass: SystemClock },
  ],
  exports: [PatientEventService],
})
export class EventsModule {}
