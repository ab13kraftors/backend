import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { TransactionStatus } from 'src/common/enums/transaction.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { LedgerService } from 'src/ledger/ledger.service';
import { Transaction } from 'src/payments/transaction/entities/transaction.entity';
import { TransactionService } from 'src/payments/transaction/transaction.service';
import { DataSource } from 'typeorm';

@Controller('/api/admin/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminTransactionController {
  constructor(
    private readonly txService: TransactionService,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  findAll(@Participant() participantId: string) {
    return this.txService.findAll({ participantId });
  }

  @Get(':txId')
  findOne(@Param('txId') txId: string, @Participant() participantId: string) {
    return this.txService.findOne(participantId, txId);
  }

  // 🔴 REVERSAL
  @Post(':txId/reverse')
  async reverse(
    @Param('txId') txId: string,
    @Participant() participantId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const tx = await manager.getRepository(Transaction).findOne({
        where: { txId, participantId },
      });

      if (!tx) throw new NotFoundException('Transaction not found');

      if (tx.status !== TransactionStatus.COMPLETED) {
        throw new BadRequestException('Only completed tx can be reversed');
      }

      const reverseTxId = `REV-${tx.txId}`;

      await this.ledger.postTransfer(
        {
          txId: reverseTxId,
          participantId,
          reference: `Reversal of ${tx.txId}`,
          postedBy: 'admin',
          currency: tx.currency,
          legs: [
            {
              finAddress: tx.receiverFinAddress,
              amount: tx.amount.toString(),
              isCredit: false,
            },
            {
              finAddress: tx.senderFinAddress,
              amount: tx.amount.toString(),
              isCredit: true,
            },
          ],
        },
        manager,
      );

      tx.status = TransactionStatus.REVERSED;
      await manager.save(tx);

      return { status: 'reversed', txId: reverseTxId };
    });
  }
}
