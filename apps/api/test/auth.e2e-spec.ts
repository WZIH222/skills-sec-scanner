import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

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

  describe('POST /auth/register', () => {
    it('Test 1: Creates user and returns JWT', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail,
          password: 'SecurePass123!',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', uniqueEmail);
      expect(response.body.user).toHaveProperty('name', 'Test User');
      expect(response.body.user).not.toHaveProperty('passwordHash');

      authToken = response.body.accessToken;
    });

    it('should reject duplicate email', async () => {
      const email = `duplicate-${Date.now()}@example.com`;

      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'SecurePass123!',
          name: 'First User',
        });

      // Duplicate registration
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'AnotherPass456!',
          name: 'Second User',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/login', () => {
    it('Test 2: Validates credentials and returns JWT', async () => {
      const email = `login-${Date.now()}@example.com`;

      // Register first
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'LoginPass123!',
          name: 'Login User',
        });

      // Login
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'LoginPass123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', email);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPass123!',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('JWT Guard', () => {
    it('Test 3: Validates Bearer token', async () => {
      // Create a user and get token
      const email = `protected-${Date.now()}@example.com`;
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'ProtectedPass123!',
          name: 'Protected User',
        });

      const token = registerResponse.body.accessToken;

      // Access protected endpoint
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', email);
    });

    it('Test 4: Returns 401 without token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/profile');

      expect(response.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
    });
  });
});
