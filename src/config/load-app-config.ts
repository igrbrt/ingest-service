import type { AppConfig } from './app-config.js';

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const processingDelayMs = readInteger(env, 'PROCESSING_DELAY_MS', 5000, 0);
  const leaseMs = readInteger(env, 'LEASE_MS', 60000, 1);
  if (leaseMs <= processingDelayMs) {
    throw new Error('LEASE_MS must be greater than PROCESSING_DELAY_MS');
  }

  const databaseUrl = readRequired(env, 'DATABASE_URL');
  if (
    !databaseUrl.startsWith('mongodb://') &&
    !databaseUrl.startsWith('mongodb+srv://')
  ) {
    throw new Error('DATABASE_URL must be a MongoDB connection string');
  }

  const ingestApiKey = readSecret(env, 'INGEST_API_KEY');
  const adminApiKey = readSecret(env, 'ADMIN_API_KEY');
  if (ingestApiKey === adminApiKey) {
    throw new Error('INGEST_API_KEY and ADMIN_API_KEY must be different');
  }

  return {
    nodeEnv: readNodeEnv(env.NODE_ENV),
    port: readInteger(env, 'PORT', 3000, 1),
    databaseUrl,
    redisHost: readRequired(env, 'REDIS_HOST'),
    redisPort: readInteger(env, 'REDIS_PORT', 6379, 1),
    ingestApiKey,
    adminApiKey,
    processingDelayMs,
    reorderWindowMs: readInteger(env, 'REORDER_WINDOW_MS', 15000, 0),
    workerConcurrency: readInteger(env, 'WORKER_CONCURRENCY', 100, 1),
    maxAttempts: readInteger(env, 'MAX_ATTEMPTS', 5, 1),
    retryBaseDelayMs: readInteger(env, 'RETRY_BASE_DELAY_MS', 1000, 1),
    leaseMs,
    reconcilerIntervalMs: readInteger(env, 'RECONCILER_INTERVAL_MS', 5000, 1),
  };
}

function readNodeEnv(value: string | undefined): AppConfig['nodeEnv'] {
  const nodeEnv =
    value === undefined || value.trim() === '' ? 'development' : value.trim();
  if (NODE_ENVIRONMENTS.includes(nodeEnv as AppConfig['nodeEnv'])) {
    return nodeEnv as AppConfig['nodeEnv'];
  }
  throw new Error('NODE_ENV must be development, test, or production');
}

function readRequired(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function readSecret(env: NodeJS.ProcessEnv, name: string): string {
  const value = readRequired(env, name);
  if (value.length < 8) {
    throw new Error(`${name} must contain at least 8 characters`);
  }
  return value;
}

function readInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(
      `Environment variable ${name} must be an integer greater than or equal to ${minimum}`,
    );
  }
  return value;
}
