import { ConfigService } from '@nestjs/config'

/**
 * Returns the JWT_SECRET from ConfigService.
 * Throws if missing — no random fallback.
 * Used by both AuthModule and JwtStrategy per D-08.
 */
export function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}
