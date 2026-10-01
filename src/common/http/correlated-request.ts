import type { Request } from 'express';

export interface CorrelatedRequest extends Request {
  correlationId?: string;
}
