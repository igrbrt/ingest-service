export interface LockRequest {
  patientId: string;
  owner: string;
  ttlMs: number;
}
