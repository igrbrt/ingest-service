export interface QueueStatusResponse {
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  paused: number;
}
