import { Injectable } from '@nestjs/common';
import { ApplicationException } from '@/common/errors/application.exception.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import type { ApplyEventInput } from '@/processing/dto/apply-event.input.js';
import type { ProcessingResult } from '@/processing/dto/processing-result.js';
import type { ExternalProcessor } from '@/processing/interface/external-processor.js';

@Injectable()
export class InstantExternalProcessor implements ExternalProcessor {
  async applyEvent(input: ApplyEventInput): Promise<ProcessingResult> {
    if (input.idempotencyKey.length === 0) {
      throw new ApplicationException(ApplicationCode.PROCESSING_FAILED);
    }
    
    return { outcome: 'accepted' };
  }
}
