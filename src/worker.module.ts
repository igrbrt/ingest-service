import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module.js';
import { ProcessingModule } from './processing/processing.module.js';

@Module({
  imports: [AppConfigModule, ProcessingModule],
})
export class WorkerModule {}
