export interface CanonicalEventPayload {
  patientId: string;
  type: string;
  data: Record<string, unknown>;
  ts: string;
}
