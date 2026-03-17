import { Controller, Param, UseGuards, Body, Post } from '@nestjs/common';
import { OtpService } from './otp.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/customers')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post(':customerId/otp')
  generate(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.otpService.generate(participantId, customerId, 'REGISTER');
  }

  @Post(':customerId/otp/verify')
  verify(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body('otp') otp: string,
  ) {
    return this.otpService.verify(participantId, customerId, otp, 'REGISTER');
  }

  @Post(':customerId/otp/complete')
  complete(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body('otp') otp: string,
  ) {
    return this.otpService.completeRegistration(participantId, customerId, otp);
  }
}
