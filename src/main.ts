import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/app-config.js';
import { APP_CONFIG } from './config/app-config.token.js';
import { configureHttpApp } from './configure-http-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureHttpApp(app);
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
}

await bootstrap();
