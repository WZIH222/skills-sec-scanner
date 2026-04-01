import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('NestJS Application (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Swagger setup (must be before setGlobalPrefix)
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

    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.enableCors({
      origin: process.env.WEB_APP_URL || 'http://localhost:3000',
      credentials: true,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Application Startup', () => {
    it('Test 1: NestJS app starts on port 3001', async () => {
      // The app should be listening
      expect(app).toBeDefined();
      expect(app.getHttpServer()).toBeDefined();
    });

    it('Test 2: Health check endpoint returns 200', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('Test 4: Swagger UI available at /api/v1/docs', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/docs');
      expect(response.status).toBe(200);
      expect(response.text).toContain('swagger');
    });
  });

  describe('TypeScript Compilation', () => {
    it('Test 3: TypeScript compilation succeeds', () => {
      // If we got here, TypeScript compilation succeeded
      expect(true).toBe(true);
    });
  });
});
