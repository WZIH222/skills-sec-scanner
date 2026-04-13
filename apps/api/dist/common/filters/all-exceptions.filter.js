"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const logger_1 = require("../logger");
let AllExceptionsFilter = class AllExceptionsFilter {
    catch(exception, host) {
        const http = host.switchToHttp();
        const request = http.getRequest();
        const response = http.getResponse();
        const status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const responseBody = this.buildResponseBody(exception, status);
        const logContext = {
            path: request.url,
            method: request.method,
            statusCode: status,
            stack: exception instanceof Error ? exception.stack : undefined,
        };
        const errorMessage = exception instanceof Error ? exception.message : String(exception);
        logger_1.appLogger.error(errorMessage, exception, logContext);
        response.status(status).json(responseBody);
    }
    buildResponseBody(exception, status) {
        if (exception instanceof common_1.HttpException) {
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                return {
                    statusCode: status,
                    message: exceptionResponse,
                    error: exception.name,
                };
            }
            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const obj = exceptionResponse;
                if (!obj.statusCode) {
                    return { ...obj, statusCode: status };
                }
                const { stack: _stack, ...safeResponse } = obj;
                return safeResponse;
            }
        }
        return {
            statusCode: status,
            message: 'Internal server error',
            error: 'Internal Server Error',
        };
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map