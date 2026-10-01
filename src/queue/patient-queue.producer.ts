import {
  Inject,
  Injectable,
  Optional,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/app-config.token.js';
import { buildPatientJobId } from './build-patient-job-id.js';
import { buildRedisConnection } from './build-redis-connection.js';
import type { PatientJobPayload } from './patient-job.payload.js';
import { PATIENT_JOB_NAME, PATIENT_QUEUE_NAME } from './patient-queue-name.js';
import { PATIENT_QUEUE } from './patient-queue.token.js';

const QUEUED_STATES = new Set<string>([
  'active',
  'waiting',
  'delayed',
  'prioritized',
  'waiting-children',
  'paused',
]);

@Injectable()
export class PatientQueueProducer implements OnModuleDestroy {
  private queue: Queue<PatientJobPayload> | undefined;
  private readonly ownsQueue: boolean;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Optional()
    @Inject(PATIENT_QUEUE)
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
      } else if (QUEUED_STATES.has(state)) {
        return;
      }
    }
    try {
      await queue.add(
        PATIENT_JOB_NAME,
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
    this.queue ??= new Queue<PatientJobPayload>(PATIENT_QUEUE_NAME, {
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
