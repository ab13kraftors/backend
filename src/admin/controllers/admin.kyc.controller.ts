import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { RejectKycDto } from 'src/kyc/dto/review-kyc.dto';
import { KycService } from 'src/kyc/kyc.service';

@Controller('/api/admin/kyc')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminKycController {
  constructor(private readonly kycService: KycService) {}

  @Get('/pending')
  getPending(@Participant() participantId: string) {
    return this.kycService.getPendingReviews(participantId);
  }

  @Get(':kycId')
  getOne(@Param('kycId') kycId: string) {
    return this.kycService.getRecord(kycId);
  }

  @Post(':kycId/approve')
  approve(@Param('kycId') kycId: string, @Participant() participantId: string) {
    return this.kycService.approveHard(kycId, participantId);
  }

  @Post(':kycId/reject')
  reject(
    @Param('kycId') kycId: string,
    @Participant() adminId: string,
    @Body() dto: RejectKycDto,
  ) {
    return this.kycService.rejectHard(kycId, adminId, dto);
  }
}
