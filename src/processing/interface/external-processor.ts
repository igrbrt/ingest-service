import type { ApplyEventInput } from '@/processing/dto/apply-event.input.js';
import type { ProcessingResult } from '@/processing/dto/processing-result.js';

export interface ExternalProcessor {
  applyEvent(input: ApplyEventInput): Promise<ProcessingResult>;
}
