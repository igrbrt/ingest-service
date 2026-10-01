import { Injectable } from '@nestjs/common';
import { ApplicationException } from '../common/errors/application.exception.js';
import { ApplicationCode } from '../common/messages/application-code.js';
import { PatientEventService } from '../events/patient-event.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { LivenessResponse } from './liveness.response.js';
import type { ReadinessResponse } from './readiness.response.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly patientEventService: PatientEventService,
    private readonly redisService: RedisService,
  ) {}

  readLiveness(): LivenessResponse {
    return { status: 'live' };
  }

  async readReadiness(): Promise<ReadinessResponse> {
    try {
      await this.patientEventService.pingDatabase();
      const pong = await this.redisService.ping();
      if (pong !== 'PONG') {
        throw new ApplicationException(ApplicationCode.SERVICE_UNAVAILABLE);
      }
    } catch (error) {
      if (error instanceof ApplicationException) {
        throw error;
      }
      throw new ApplicationException(ApplicationCode.SERVICE_UNAVAILABLE);
    }
    return { status: 'ready' };
  }
}
