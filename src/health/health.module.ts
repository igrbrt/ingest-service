import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module.js';
import { EventsModule } from '@/events/events.module.js';
import { HealthController } from '@/health/health.controller.js';
import { HealthService } from '@/health/health.service.js';

@Module({
  imports: [CommonModule, EventsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
