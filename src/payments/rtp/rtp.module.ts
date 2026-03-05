import { Module } from '@nestjs/common';
import { RtpController } from './rtp.controller';
import { RtpService } from './rtp.service';

@Module({
  controllers: [RtpController],
  providers: [RtpService]
})
export class RtpModule {}
