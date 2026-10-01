import { createHash } from 'node:crypto';

export function buildPatientJobId(patientId: string): string {
  return createHash('sha256').update(patientId).digest('hex');
}
