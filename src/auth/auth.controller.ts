import { Controller, Post, Res } from '@nestjs/common';

import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('token')
  async login(@Res({ passthrough: true }) res) {
    const token = await this.authService.login();

    res.cookie('nssl-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });
    return { success: true };
  }
}
