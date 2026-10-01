import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { RedisService } from './redis.service.js';

@Module({
  imports: [AppConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
