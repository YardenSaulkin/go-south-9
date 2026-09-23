import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });
  // Maintenance-report photos are posted as data URLs, which are far larger
  // than the default body limit allows.
  app.useBodyParser('json', { limit: '8mb' });
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    allowedHeaders: ['Content-Type', 'x-user-id'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
