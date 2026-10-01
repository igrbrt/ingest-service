import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [EventsModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
