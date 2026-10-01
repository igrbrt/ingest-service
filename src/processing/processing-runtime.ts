import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '../config/app-config.js';
import { APP_CONFIG } from '../config/app-config.token.js';
import type { Clock } from '../common/clock/clock.js';
import { CLOCK } from '../common/clock/clock.token.js';
import { EXTERNAL_PROCESSOR } from './external-processor.token.js';
import type { ExternalProcessor } from './external-processor.js';

@Injectable()
export class ProcessingRuntime {
  constructor(
    @Inject(APP_CONFIG) readonly config: AppConfig,
    @Inject(CLOCK) readonly clock: Clock,
    @Inject(EXTERNAL_PROCESSOR) readonly externalProcessor: ExternalProcessor,
  ) {}
}
