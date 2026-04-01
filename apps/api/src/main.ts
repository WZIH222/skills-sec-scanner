import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger/OpenAPI documentation (must be before setGlobalPrefix)
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

  console.log(`🚀 API Server running on http://localhost:${port}`);
  console.log(`📚 Swagger documentation at http://localhost:${port}/api/docs`);
}

bootstrap();
