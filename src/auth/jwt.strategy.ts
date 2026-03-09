import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      // Extract JWT from cookie named 'nssl-token'
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const token = (req as any)?.cookies?.['nssl-token'] as
            | string
            | undefined;
          return token || null;
        },
      ]),

      // Enforce token expiration validation
      ignoreExpiration: false,

      // Load JWT secret from environment variable
      secretOrKey: (() => {
        const s = process.env.JWT_SECRET;
        if (!s) throw new Error('JWT_SECRET environment variable is not set');
        return s;
      })(),
    });
  }

  // ================== validate ==================
  // Validates decoded JWT payload using AuthService
  async validate(payload: Record<string, any>): Promise<any> {
    return await this.authService.validate(payload);
  }
}
