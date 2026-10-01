import { Module } from '@nestjs/common';
import { CLOCK } from '../common/clock/clock.token.js';
import { SystemClock } from '../common/clock/system-clock.js';
import { AppConfigModule } from '../config/app-config.module.js';
import { EventsModule } from '../events/events.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { DelayedExternalProcessor } from './delayed-external-processor.js';
import { EXTERNAL_PROCESSOR } from './external-processor.token.js';
import { PATIENT_LOCK } from './patient-lock.token.js';
import { PatientDrainService } from './patient-drain.service.js';
import { PatientDrainWorker } from './patient-drain.worker.js';
import { PatientLock } from './patient-lock.js';
import { ProcessingRuntime } from './processing-runtime.js';

@Module({
  imports: [AppConfigModule, EventsModule, QueueModule, RedisModule],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: EXTERNAL_PROCESSOR, useClass: DelayedExternalProcessor },
    { provide: PATIENT_LOCK, useClass: PatientLock },
    ProcessingRuntime,
    PatientDrainService,
    PatientDrainWorker,
  ],
})
export class ProcessingModule {}
