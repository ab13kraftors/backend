import { Module } from '@nestjs/common';
import { VerifyController } from './verify.controller';
import { VerifyService } from './verify.service';
import { CasModule } from 'src/cas/cas.module';
import { AuthModule } from 'src/auth/auth.module';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';

@Module({
  imports: [AuthModule, CasModule],
  controllers: [VerifyController],
  providers: [VerifyService, ParticipantGuard],
})
export class VerifyModule {}
