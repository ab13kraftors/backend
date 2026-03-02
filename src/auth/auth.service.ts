import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login() {
    // todo use real db validation
    const payload = {
      sub: 'system-user',
      participantId: 'test-participant',
      roles: 'admin',
    };

    return this.jwtService.sign(payload);
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
