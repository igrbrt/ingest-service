export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  ingestApiKey: string;
  adminApiKey: string;
  processingDelayMs: number;
  reorderWindowMs: number;
  workerConcurrency: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
  leaseMs: number;
  reconcilerIntervalMs: number;
}
