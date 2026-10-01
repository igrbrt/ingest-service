import { Module } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { AppConfigModule } from '@/config/app-config.module.js';

@Module({
  imports: [AppConfigModule],
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class CommonModule {}
