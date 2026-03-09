import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { VerifyService } from './verify.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { VerifyAccountDto } from './dto/verify-account.dto';

@UseGuards(JwtAuthGuard)
@Controller('/api/switch/v1/verify')
export class VerifyController {
  constructor(
    // Inject Verify service
    private readonly verifyService: VerifyService,
  ) {}

  // ================== verify ==================
  // Verifies account alias via CAS
  @Post('account')
  verify(@Body() dto: VerifyAccountDto) {
    return this.verifyService.verifyAccount(dto);
  }
}
