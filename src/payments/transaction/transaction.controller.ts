import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';
import { TransactionStatus } from 'src/common/enums/transaction.enums';

@UseGuards(JwtAuthGuard, ParticipantGuard)
@Controller('/api/switch/v1/transactions')
export class TransactionController {
  constructor(private readonly txService: TransactionService) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query('pageNo') pageNo: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('status') status?: TransactionStatus,
  ) {
    return this.txService.findAll(
      req.participantId,
      Number(pageNo),
      Number(pageSize),
      status,
    );
  }

  @Get(':txId')
  async findOne(@Param('txId') txId: string) {
    return this.txService.findOne(txId);
  }
}
