import { Module } from '@nestjs/common';
import { AppConfigModule } from '@/config/app-config.module.js';
import { PatientQueueProducer } from '@/queue/patient-queue.producer.js';

@Module({
  imports: [AppConfigModule],
  providers: [PatientQueueProducer],
  exports: [PatientQueueProducer],
})
export class QueueModule {}
