"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appLogger = exports.AppLogger = void 0;
const common_1 = require("@nestjs/common");
const REDACT_PATTERNS = [
    { pattern: /(JWT_SECRET)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
    { pattern: /(OPENAI_API_KEY)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
    { pattern: /(ANTHROPIC_API_KEY)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
    { pattern: /(DATABASE_URL)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
    { pattern: /(REDIS_URL)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
    { pattern: /Bearer [^\s]*/gi, replacement: 'Bearer [REDACTED]' },
];
class AppLogger extends common_1.ConsoleLogger {
    redactSecrets(input) {
        let result = input;
        for (const { pattern, replacement } of REDACT_PATTERNS) {
            result = result.replace(pattern, replacement);
        }
        return result;
    }
    error(message, ...optionalParams) {
        const redactedMessage = this.redactSecrets(message);
        const stack = optionalParams[0];
        const isProduction = process.env.NODE_ENV !== 'development';
        if (isProduction && stack instanceof Error && stack.stack) {
            super.error(redactedMessage);
        }
        else if (stack instanceof Error) {
            super.error(redactedMessage, stack.stack);
        }
        else {
            super.error(redactedMessage, ...optionalParams);
        }
    }
    log(message, ...optionalParams) {
        super.log(this.redactSecrets(message), ...optionalParams);
    }
    warn(message, ...optionalParams) {
        super.warn(this.redactSecrets(message), ...optionalParams);
    }
    debug(message, ...optionalParams) {
        super.debug(this.redactSecrets(message), ...optionalParams);
    }
    verbose(message, ...optionalParams) {
        super.verbose(this.redactSecrets(message), ...optionalParams);
    }
}
exports.AppLogger = AppLogger;
exports.appLogger = new AppLogger();
//# sourceMappingURL=logger.js.map