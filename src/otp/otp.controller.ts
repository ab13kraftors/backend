import {
  Controller,
  Param,
  UseGuards,
  Get,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OtpService } from './otp.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/cas/v2/customer')
export class OtpController {
  constructor(
    // Inject OTP service
    private readonly otpService: OtpService,
  ) {}

  // ================== generateOtp ==================
  // Generates OTP for customer activation
  @Get(':uuid/otp')
  generateOtp(
    @Participant() participantId: string,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    return this.otpService.generate(participantId, uuid);
  }

  // ================== completeOtp ==================
  // Verifies OTP and activates the customer
  @Post(':uuid/:otp/completion')
  completeOtp(
    @Participant() participantId: string,
    @Param('uuid') uuid: string,
    @Param('otp') otpcode: string,
  ) {
    return this.otpService.complete(participantId, uuid, otpcode);
  }
}
