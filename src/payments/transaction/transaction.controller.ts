import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/transactions')
export class TransactionController {
  constructor(private readonly txService: TransactionService) {}

  @Get()
  async findAll(
    @Participant() participantId: string,
    @Query('pageNo') pageNo: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('status') status?: TransactionStatus,
    @Query('channel') channel?: TransactionType,
    @Query('currency') currency?: Currency,
    @Query('customerId') customerId?: string,
    @Query('finAddress') finAddress?: string,
  ) {
    return this.txService.findAll({
      participantId,
      pageNo: Number(pageNo),
      pageSize: Number(pageSize),
      status,
      channel,
      currency,
      customerId,
      finAddress,
    });
  }

  @Get(':txId')
  async findOne(
    @Participant() participantId: string,
    @Param('txId') txId: string,
  ) {
    return this.txService.findOne(participantId, txId);
  }
}
