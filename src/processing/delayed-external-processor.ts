import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/app-config.token.js';
import { ApplicationException } from '../common/errors/application.exception.js';
import { ApplicationCode } from '../common/messages/application-code.js';
import { delay } from '../common/utils/delay.js';
import type { ApplyEventInput } from './apply-event.input.js';
import type { ExternalProcessor } from './external-processor.js';
import type { ProcessingResult } from './processing-result.js';

@Injectable()
export class DelayedExternalProcessor implements ExternalProcessor {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async applyEvent(input: ApplyEventInput): Promise<ProcessingResult> {
    if (input.idempotencyKey.length === 0) {
      throw new ApplicationException(ApplicationCode.PROCESSING_FAILED);
    }
    await delay(this.config.processingDelayMs);
    return { outcome: 'accepted' };
  }
}
