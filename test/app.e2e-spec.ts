import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureHttpApp } from './../src/configure-http-app.js';

process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL =
  'mongodb://localhost:27017/ingest?replicaSet=rs0&directConnection=true';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.INGEST_API_KEY = 'test-ingest-key';
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.PROCESSING_DELAY_MS = '0';
process.env.REORDER_WINDOW_MS = '0';
process.env.LEASE_MS = '1000';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApp(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
