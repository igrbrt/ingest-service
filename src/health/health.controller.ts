import { Controller, Get } from '@nestjs/common';
import { HealthService } from '@/health/health.service.js';
import type { LivenessResponse } from '@/health/dto/liveness.response.js';
import type { ReadinessResponse } from '@/health/dto/readiness.response.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  readLiveness(): LivenessResponse {
    return this.healthService.readLiveness();
  }

  @Get('ready')
  async readReadiness(): Promise<ReadinessResponse> {
    return this.healthService.readReadiness();
  }
}
