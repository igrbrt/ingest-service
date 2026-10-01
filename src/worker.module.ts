import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module.js';
import { ProcessingModule } from './processing/processing.module.js';
import { ReconciliationModule } from './reconciliation/reconciliation.module.js';

@Module({
  imports: [AppConfigModule, ProcessingModule, ReconciliationModule],
})
export class WorkerModule {}
