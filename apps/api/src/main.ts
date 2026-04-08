import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLogger, appLogger } from './common/logger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers via Helmet
  app.use(helmet());

  // Register centralized logger with secret redaction
  app.useLogger(appLogger);

  // Global exception filter — prevents stack traces from reaching clients
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger/OpenAPI documentation — only mounted in non-production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Skills Security Scanner API')
      .setDescription('REST API for detecting security threats in AI Skills files')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('health', 'Health check endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document);
  }

  // Global prefix for API versioning
  app.setGlobalPrefix('api/v1');

  // Enable CORS for web app
  app.enableCors({
    origin: process.env.WEB_APP_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Validation pipe with transform
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.API_PORT || 3001;
  await app.listen(port);

  appLogger.log(`🚀 API Server running on http://localhost:${port}/api/v1`);
}

bootstrap();
