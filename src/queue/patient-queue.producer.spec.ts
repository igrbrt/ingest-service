import { Queue } from 'bullmq';
import type { AppConfig } from '../config/app-config.js';
import { buildPatientJobId } from './build-patient-job-id.js';
import { PatientQueueProducer } from './patient-queue.producer.js';
import type { PatientJobPayload } from './patient-job.payload.js';
import { PATIENT_JOB_NAME } from './patient-queue-name.js';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 3000,
  databaseUrl: 'mongodb://localhost:27017/ingest',
  redisHost: 'localhost',
  redisPort: 6379,
  ingestApiKey: 'test-ingest-key',
  adminApiKey: 'test-admin-key',
  processingDelayMs: 0,
  reorderWindowMs: 0,
  workerConcurrency: 100,
  maxAttempts: 5,
  retryBaseDelayMs: 1000,
  leaseMs: 30000,
  reconcilerIntervalMs: 5000,
};

function createProducer(jobState?: string): {
  producer: PatientQueueProducer;
  add: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
} {
  const retry = vi.fn(async () => undefined);
  const add = vi.fn(async () => undefined);
  const queue = {
    getJob: vi.fn(async () =>
      jobState
        ? {
            getState: async () => jobState,
            retry,
            remove: async () => undefined,
          }
        : undefined,
    ),
    add,
    getJobCounts: vi.fn(async () => ({
      waiting: 1,
      active: 2,
      failed: 3,
      delayed: 4,
    })),
    isPaused: vi.fn(async () => false),
    close: vi.fn(async () => undefined),
  };
  const producer = new PatientQueueProducer(
    config,
    queue as unknown as Queue<PatientJobPayload>,
  );
  return { producer, add, retry };
}

describe('PatientQueueProducer', () => {
  it('treats an active patient job as success', async () => {
    const { producer, add } = createProducer('active');
    await producer.enqueuePatient({ patientId: 'patient-1' });
    expect(add).not.toHaveBeenCalled();
  });

  it('retries a failed patient job instead of creating another', async () => {
    const { producer, add, retry } = createProducer('failed');
    await producer.enqueuePatient({ patientId: 'patient-1' });
    expect(retry).toHaveBeenCalledOnce();
    expect(add).not.toHaveBeenCalled();
  });

  it('enqueues a deterministic job when the patient has no job', async () => {
    const { producer, add } = createProducer();
    await producer.enqueuePatient({ patientId: 'patient-1' });
    expect(add).toHaveBeenCalledWith(
      PATIENT_JOB_NAME,
      { patientId: 'patient-1' },
      {
        jobId: buildPatientJobId('patient-1'),
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });
});
