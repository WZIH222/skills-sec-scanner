"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireJwtSecret = requireJwtSecret;
function requireJwtSecret(config) {
    const secret = config.get('JWT_SECRET');
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    return secret;
}
//# sourceMappingURL=require-jwt-secret.js.map