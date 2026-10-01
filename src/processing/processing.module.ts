import { Module } from '@nestjs/common';
import { SystemClock } from '@/common/clock/system-clock.js';
import { CommonModule } from '@/common/common.module.js';
import { AppConfigModule } from '@/config/app-config.module.js';
import { EventsModule } from '@/events/events.module.js';
import { QueueModule } from '@/queue/queue.module.js';
import { AppConstants } from '@/app.constants.js';
import { DelayedExternalProcessor } from '@/processing/delayed-external-processor.js';
import { PatientDrainService } from '@/processing/patient-drain.service.js';
import { PatientDrainWorker } from '@/processing/patient-drain.worker.js';
import { PatientLock } from '@/processing/patient-lock.js';
import { ProcessingRuntime } from '@/processing/processing-runtime.js';

@Module({
  imports: [AppConfigModule, CommonModule, EventsModule, QueueModule],
  providers: [
    { provide: AppConstants.CLOCK_TOKEN, useClass: SystemClock },
    {
      provide: AppConstants.EXTERNAL_PROCESSOR_TOKEN,
      useClass: DelayedExternalProcessor,
    },
    { provide: AppConstants.PATIENT_LOCK_TOKEN, useClass: PatientLock },
    ProcessingRuntime,
    PatientDrainService,
    PatientDrainWorker,
  ],
})
export class ProcessingModule {}
