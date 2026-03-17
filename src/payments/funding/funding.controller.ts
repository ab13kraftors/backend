import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { FundingService } from './funding.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateFundingDto } from './dto/create-funding.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/funding')
export class FundingController {
  constructor(private readonly fundingService: FundingService) {}

  @Post('topup')
  topup(@Body() dto: CreateFundingDto, @Participant() participantId: string) {
    return this.fundingService.topup(participantId, dto);
  }

  @Post('withdraw')
  withdraw(
    @Body() dto: CreateFundingDto,
    @Participant() participantId: string,
  ) {
    return this.fundingService.withdraw(participantId, dto);
  }

  @Get()
  findAll(@Participant() participantId: string) {
    return this.fundingService.findAll(participantId);
  }

  @Get(':fundingId')
  findOne(
    @Participant() participantId: string,
    @Param('fundingId') fundingId: string,
  ) {
    return this.fundingService.findOne(participantId, fundingId);
  }
}
