import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { VerifyService } from './verify.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { VerifyAccountDto } from './dto/verify-account.dto';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/verify')
export class VerifyController {
  constructor(private readonly verifyService: VerifyService) {}

  @Post('account')
  verify(@Body() dto: VerifyAccountDto) {
    return this.verifyService.verifyAccount(dto);
  }
}
