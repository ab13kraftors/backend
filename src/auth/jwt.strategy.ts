import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';
import { Request } from 'express';

export interface JwtUser {
  participantId: string;
  username: string;
  roles: string[];
  // add more fields if needed (email, etc.)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const token = req?.cookies?.['nssl-token'] as string | undefined;
          return token || null;
        },
      ]),

      ignoreExpiration: false, //  token expiration

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
    const validated = await this.authService.validate(payload);

    return {
      participantId: validated.participantId,
      username: validated.username,
      roles: validated.roles || [],
    };
  }
}
