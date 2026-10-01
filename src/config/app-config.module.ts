import { Module } from '@nestjs/common';
import type { AppConfig } from './app-config.js';
import { APP_CONFIG } from './app-config.token.js';
import { loadAppConfig } from './load-app-config.js';

@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadAppConfig(process.env),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
