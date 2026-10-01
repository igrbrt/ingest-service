import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { AppConstants } from '@/app.constants.js';
import { buildRedisConnection } from '@/common/utils/helper.js';
import type { AppConfig } from '@/config/app-config.js';
import type { PatientJobPayload } from '@/queue/dto/patient-job.payload.js';
import { PatientDrainService } from '@/processing/patient-drain.service.js';

@Injectable()
export class PatientDrainWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PatientDrainWorker.name);
  private worker: Worker<PatientJobPayload> | undefined;

  constructor(
    private readonly patientDrainService: PatientDrainService,
    @Inject(AppConstants.APP_CONFIG_TOKEN) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<PatientJobPayload>(
      AppConstants.PATIENT_QUEUE_NAME,
      (job) =>
        this.patientDrainService.drainPatient({
          patientId: job.data.patientId,
        }),
      {
        connection: buildRedisConnection(this.config),
        concurrency: this.config.workerConcurrency,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Drain job ${job?.id ?? 'unknown'} failed: ${error.name}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
