import {
  Controller,
  Param,
  UseGuards,
  Get,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OtpService } from './otp.service';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(ParticipantGuard)
@Controller('api/fp/cas/v2/customer')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Get(':uuid/otp')
  generateOtp(
    @Participant() participantId: string,
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
  ) {
    return this.otpService.generate(participantId, uuid);
  }

  @Post(':uuid/:otp/completion')
  completeOtp(
    @Participant() participantId: string,
    @Param('uuid') uuid: string,
    @Param('otp') otpcode: string,
  ) {
    return this.otpService.complete(participantId, uuid, otpcode);
  }
}
