import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './gateway.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors();

  // Add body parsing middleware
  app.use(json({ limit: '10mb' }));

  // Add global validation pipe
  app.useGlobalPipes(new ValidationPipe());

  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`Gateway service is running on port ${port}`);
}
bootstrap();
