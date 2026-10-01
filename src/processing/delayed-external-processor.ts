import { Inject, Injectable } from '@nestjs/common';
import { AppConstants } from '@/app.constants.js';
import type { AppConfig } from '@/config/app-config.js';
import { ApplicationException } from '@/common/errors/application.exception.js';
import { ApplicationCode } from '@/common/messages/application-code.js';
import { delay } from '@/common/utils/helper.js';
import type { ApplyEventInput } from '@/processing/dto/apply-event.input.js';
import type { ProcessingResult } from '@/processing/dto/processing-result.js';
import type { ExternalProcessor } from '@/processing/interface/external-processor.js';

@Injectable()
export class DelayedExternalProcessor implements ExternalProcessor {
  constructor(
    @Inject(AppConstants.APP_CONFIG_TOKEN) private readonly config: AppConfig,
  ) {}

  async applyEvent(input: ApplyEventInput): Promise<ProcessingResult> {
    if (input.idempotencyKey.length === 0) {
      throw new ApplicationException(ApplicationCode.PROCESSING_FAILED);
    }

    await delay(this.config.processingDelayMs);
    
    return { outcome: 'accepted' };
  }
}
