import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { LimitsRiskService } from './limits-risk.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { CheckLimitDto } from './dto/check-limit.dto';
import { KycService } from 'src/kyc/kyc.service';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/limits')
export class LimitsRiskController {
  constructor(
    private readonly service: LimitsRiskService,
    private readonly kycService: KycService,
  ) {}

  @Post('check')
  async check(
    @Participant() participantId: string,
    @Body() dto: CheckLimitDto,
  ) {
    const tier = await this.kycService.getTier(dto.customerId, participantId);
    return this.service.check(
      participantId,
      dto.customerId,
      tier,
      dto.amount,
      dto.direction,
    );
  }
}
