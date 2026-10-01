import type { ConnectionOptions } from 'bullmq';
import type { AppConfig } from '../config/app-config.js';

export function buildRedisConnection(config: AppConfig): ConnectionOptions {
  return {
    host: config.redisHost,
    port: config.redisPort,
    maxRetriesPerRequest: null,
  };
}
