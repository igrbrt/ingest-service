import { Module } from '@nestjs/common';
import { AppConstants } from '@/app.constants.js';
import type { AppConfig } from '@/config/app-config.js';
import { loadAppConfig } from '@/config/load-app-config.js';

@Module({
  providers: [
    {
      provide: AppConstants.APP_CONFIG_TOKEN,
      useFactory: (): AppConfig => loadAppConfig(process.env),
    },
  ],
  exports: [AppConstants.APP_CONFIG_TOKEN],
})

export class AppConfigModule {}
