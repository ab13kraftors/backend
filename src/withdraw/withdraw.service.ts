import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Withdrawal } from './entities/withdraw.entity';
import { WithdrawDto } from './dto/withdraw.dto';

import { WalletService } from 'src/wallet/wallet.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { KycService } from 'src/kyc/kyc.service';

import { KycTier } from 'src/common/enums/kyc.enums';
import { WITHDRAWAL_POOL_FIN_ADDRESS } from 'src/common/constants';
import { CardTransaction } from 'src/common/enums/transaction.enums';

@Injectable()
export class WithdrawService {
  constructor(
    @InjectRepository(Withdrawal)
    private withdrawRepo: Repository<Withdrawal>,

    private walletService: WalletService,
    private ledgerService: LedgerService,
    private kycService: KycService,
    private dataSource: DataSource,
  ) {}

  async withdraw(dto: WithdrawDto, participantId: string) {
    const wallet = await this.walletService.getWallet(
      dto.walletId,
      participantId,
    );

    if (!wallet) throw new NotFoundException('Wallet not found');

    await this.walletService.verifyPinWithLock(wallet, participantId, dto.pin);

    await this.kycService.requireTier(wallet.ccuuid, KycTier.HARD_APPROVED);

    return this.dataSource.transaction(async (manager) => {
      const txId = `WD-${Date.now()}`;

      await this.ledgerService.postTransfer({
        txId,
        reference: 'Wallet withdrawal',
        participantId,
        postedBy: 'withdraw-service',

        legs: [
          {
            finAddress: wallet.finAddress,
            amount: dto.amount,
            isCredit: true,
            memo: 'Withdrawal debit',
          },

          {
            finAddress: WITHDRAWAL_POOL_FIN_ADDRESS,
            amount: dto.amount,
            isCredit: false,
            memo: 'Withdrawal settlement',
          },
        ],
      });

      const withdrawal = this.withdrawRepo.create({
        participantId,
        walletId: wallet.walletId,
        ccuuid: wallet.ccuuid,
        amount: dto.amount,
        destination: dto.destination,
        status: CardTransaction.INITIATED,
      });

      return manager.save(withdrawal);
    });
  }
}
