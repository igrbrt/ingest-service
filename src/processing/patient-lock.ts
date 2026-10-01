import { Injectable } from '@nestjs/common';
import type { PatientLockPort } from './patient-lock.port.js';
import type { LockRequest } from './lock-request.js';
import { RedisService } from '../redis/redis.service.js';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

const EXTEND_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

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
        EXTEND_SCRIPT,
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
      .eval(RELEASE_SCRIPT, 1, this.key(input.patientId), input.owner);
  }

  private key(patientId: string): string {
    return `ingest:patient-lock:${patientId}`;
  }
}
