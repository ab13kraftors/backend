import {
  Controller,
  Post,
  Delete,
  Body,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

// ================== Cookie Config ==================
// Cookie name used to store JWT token
const COOKIE_NAME = 'nssl-token';

// Secure cookie configuration
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  maxAge: 15 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(
    // Inject Auth service
    private readonly authService: AuthService,
  ) {}

  // ================== login ==================
  // Authenticates user and stores JWT in secure cookie
  @Post('token')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: any) {
    const token = await this.authService.login(dto);

    // Set JWT token as HTTP-only cookie
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);

    return { success: true };
  }

  // ================== refresh ==================
  @Post('refresh')
  @UseGuards(JwtAuthGuard) // Requires a currently valid token to refresh
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    // Generate a new token based on the existing user's data
    const newToken = await this.authService.login({
      username: req.user.username,
    } as any);

    res.cookie(COOKIE_NAME, newToken, COOKIE_OPTS);
    return { success: true };
  }

  // ================== logout ==================
  // Clears authentication cookie
  @Delete('token')
  @UseGuards(JwtAuthGuard)
  logout(@Res({ passthrough: true }) res: any) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    return { success: true };
  }
}
