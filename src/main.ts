import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module.js';
import { AppConstants } from '@/app.constants.js';
import type { AppConfig } from '@/config/app-config.js';
import { configureHttpApp } from '@/configure-http-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureHttpApp(app);
  
  const config = app.get<AppConfig>(AppConstants.APP_CONFIG_TOKEN);
  await app.listen(config.port);
}

await bootstrap();
