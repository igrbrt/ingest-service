import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConstants } from '@/app.constants.js';
import type { AppConfig } from '@/config/app-config.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(@Inject(AppConstants.APP_CONFIG_TOKEN) config: AppConfig) {
    this.client = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    await this.ensureConnected();

    return this.client.ping();
  }

  async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      this.client.disconnect();

      return;
    }
    
    await this.client.quit();
  }
}
