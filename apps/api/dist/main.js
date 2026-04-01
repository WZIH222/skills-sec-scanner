"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Skills Security Scanner API')
        .setDescription('REST API for detecting security threats in AI Skills files')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('auth', 'Authentication endpoints')
        .addTag('health', 'Health check endpoints')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/v1/docs', app, document);
    app.setGlobalPrefix('api/v1');
    app.enableCors({
        origin: process.env.WEB_APP_URL || 'http://localhost:3000',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
    }));
    const port = process.env.API_PORT || 3001;
    await app.listen(port);
    console.log(`🚀 API Server running on http://localhost:${port}`);
    console.log(`📚 Swagger documentation at http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map