import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { TransactionStatus } from 'src/common/enums/transaction.enums';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('/api/switch/v1/transactions')
export class TransactionController {
  constructor(
    // Inject Transaction service
    private readonly txService: TransactionService,
  ) {}

  // ================== findAll ==================
  // Returns paginated transactions for the participant
  @Get()
  async findAll(
    @Participant() participantId: string,
    @Query('pageNo') pageNo: number = 1,
    @Query('pageSize') pageSize: number = 20,
    @Query('status') status?: TransactionStatus,
  ) {
    return this.txService.findAll(
      participantId,
      Number(pageNo),
      Number(pageSize),
      status,
    );
  }

  // ================== findOne ==================
  // Fetch a transaction by ID
  @Get(':txId')
  async findOne(@Param('txId') txId: string) {
    return this.txService.findOne(txId);
  }
}
