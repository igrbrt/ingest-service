import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '@/config/app-config.js';
import type { Clock } from '@/common/clock/clock.js';
import { AppConstants } from '@/app.constants.js';
import type { ExternalProcessor } from '@/processing/interface/external-processor.js';

@Injectable()
export class ProcessingRuntime {
  constructor(
    @Inject(AppConstants.APP_CONFIG_TOKEN) readonly config: AppConfig,
    @Inject(AppConstants.CLOCK_TOKEN) readonly clock: Clock,
    @Inject(AppConstants.EXTERNAL_PROCESSOR_TOKEN)
    readonly externalProcessor: ExternalProcessor,
  ) {}
}
