import {
  Inject,
  Injectable,
  Optional,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConstants } from '@/app.constants.js';
import { buildPatientJobId, buildRedisConnection } from '@/common/utils/helper.js';
import type { AppConfig } from '@/config/app-config.js';
import type { PatientJobPayload } from '@/queue/dto/patient-job.payload.js';

@Injectable()
export class PatientQueueProducer implements OnModuleDestroy {
  private queue: Queue<PatientJobPayload> | undefined;
  private readonly ownsQueue: boolean;

  constructor(
    @Inject(AppConstants.APP_CONFIG_TOKEN) private readonly config: AppConfig,
    @Optional()
    @Inject(AppConstants.PATIENT_QUEUE_TOKEN)
    injectedQueue?: Queue<PatientJobPayload>,
  ) {
    this.queue = injectedQueue;
    this.ownsQueue = injectedQueue === undefined;
  }

  async enqueuePatient(input: { patientId: string }): Promise<void> {
    const queue = this.getQueue();
    const jobId = buildPatientJobId(input.patientId);
    const existing = await queue.getJob(jobId);

    if (existing) {
      const state = await existing.getState();

      if (state === 'failed') {
        await existing.retry();
        return;
      }

      if (state === 'completed') {
        await existing.remove();
      } else if (AppConstants.QUEUED_STATES.has(state)) {
        return;
      }
    }

    try {
      await queue.add(
        AppConstants.PATIENT_JOB_NAME,
        { patientId: input.patientId },
        { jobId, removeOnComplete: true, removeOnFail: false },
      );
    } catch (error) {
      if (isExistingJobError(error)) {
        return;
      }

      throw error;
    }
  }

  async readCounts(): Promise<{
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.getQueue();
    const counts = await queue.getJobCounts(
      'waiting',
      'active',
      'failed',
      'delayed',
    );

    const isPaused = await queue.isPaused();

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: isPaused ? 1 : 0,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ownsQueue) {
      await this.queue?.close();
    }
  }

  private getQueue(): Queue<PatientJobPayload> {
    this.queue ??= new Queue<PatientJobPayload>(AppConstants.PATIENT_QUEUE_NAME, {
      connection: buildRedisConnection(this.config),
    });

    return this.queue;
  }
}

function isExistingJobError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('already exists')
  );
}
