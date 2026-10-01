import type { LockRequest } from '@/processing/dto/lock-request.js';

export interface PatientLockPort {
  acquire(input: LockRequest): Promise<boolean>;
  extend(input: LockRequest): Promise<boolean>;
  release(input: { patientId: string; owner: string }): Promise<void>;
}
