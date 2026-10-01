import { Injectable } from '@nestjs/common';
import type { PatientLockPort } from '@/processing/interface/patient-lock.port.js';
import type { LockRequest } from '@/processing/dto/lock-request.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { AppConstants } from '@/app.constants.js';


@Injectable()
export class PatientLock implements PatientLockPort {
  constructor(private readonly redisService: RedisService) {}

  async acquire(input: LockRequest): Promise<boolean> {
    await this.redisService.ensureConnected();

    const result = await this.redisService
      .getClient()
      .set(this.key(input.patientId), input.owner, 'PX', input.ttlMs, 'NX');

    return result === 'OK';
  }

  async extend(input: LockRequest): Promise<boolean> {
    await this.redisService.ensureConnected();

    const result = await this.redisService
      .getClient()
      .eval(
        AppConstants.EXTEND_SCRIPT,
        1,
        this.key(input.patientId),
        input.owner,
        String(input.ttlMs),
      );

    return result === 1;
  }

  async release(input: { patientId: string; owner: string }): Promise<void> {
    await this.redisService.ensureConnected();
    
    await this.redisService
      .getClient()
      .eval(AppConstants.RELEASE_SCRIPT, 1, this.key(input.patientId), input.owner);
  }

  private key(patientId: string): string {
    return `ingest:patient-lock:${patientId}`;
  }
}
