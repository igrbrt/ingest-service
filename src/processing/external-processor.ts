import type { ApplyEventInput } from './apply-event.input.js';
import type { ProcessingResult } from './processing-result.js';

export interface ExternalProcessor {
  applyEvent(input: ApplyEventInput): Promise<ProcessingResult>;
}
