import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { AuthService } from './auth.service';

// Cache the generated secret so both JwtStrategy and JwtModule use the same value
let cachedJwtSecret: string | null = null;

function getJwtSecret(config: ConfigService): string {
  if (cachedJwtSecret) return cachedJwtSecret;

  const configured = config.get<string>('JWT_SECRET');
  if (configured) {
    cachedJwtSecret = configured;
    return configured;
  }

  // Generate a random 32-byte secret at runtime if not configured
  cachedJwtSecret = randomBytes(32).toString('base64');
  return cachedJwtSecret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(configService),
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}