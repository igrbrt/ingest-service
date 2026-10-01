import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/app-config.token.js';
import { buildRedisConnection } from '../queue/build-redis-connection.js';
import type { PatientJobPayload } from '../queue/patient-job.payload.js';
import { PATIENT_QUEUE_NAME } from '../queue/patient-queue-name.js';
import { PatientDrainService } from './patient-drain.service.js';

@Injectable()
export class PatientDrainWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PatientDrainWorker.name);
  private worker: Worker<PatientJobPayload> | undefined;

  constructor(
    private readonly patientDrainService: PatientDrainService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<PatientJobPayload>(
      PATIENT_QUEUE_NAME,
      (job) => this.patientDrainService.drainPatient({ patientId: job.data.patientId }),
      {
        connection: buildRedisConnection(this.config),
        concurrency: this.config.workerConcurrency,
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(`Drain job ${job?.id ?? 'unknown'} failed: ${error.name}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
