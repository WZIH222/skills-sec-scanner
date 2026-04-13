"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const logger_1 = require("./common/logger");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, helmet_1.default)());
    app.useLogger(logger_1.appLogger);
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    if (process.env.NODE_ENV !== 'production') {
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
    }
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
    logger_1.appLogger.log(`🚀 API Server running on http://localhost:${port}/api/v1`);
}
bootstrap();
//# sourceMappingURL=main.js.map