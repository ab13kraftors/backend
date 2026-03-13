// src/payments/funding/funding.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FundingWallet } from './entities/funding.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { FundingWalletDto } from './dto/fund-wallet.dto';
import { TransactionStatus } from 'src/common/enums/transaction.enums';
import { LedgerService } from 'src/ledger/ledger.service';

@Injectable()
export class FundingService {
  private readonly SYSTEM_POOL_FIN = 'SYSTEM_INTERNAL';

  constructor(
    @InjectRepository(FundingWallet)
    private fundingRepo: Repository<FundingWallet>,
    @InjectRepository(Wallet)
    private walletRepo: Repository<Wallet>,
    private readonly ledgerService: LedgerService,
    private readonly dataSource: DataSource, // 1. Inject DataSource
  ) {}

  async fundingWallet(participantId: string, dto: FundingWalletDto) {
    const wallet = await this.walletRepo.findOne({
      where: { walletId: dto.walletId, participantId },
    });

    if (!wallet)
      throw new NotFoundException('Wallet does not exist or access denied');

    // 2. Start Transaction
    return await this.dataSource.transaction(async (manager) => {
      // Create initial record within transaction
      const funding = await manager.save(
        manager.create(FundingWallet, {
          ...dto,
          participantId,
          status: TransactionStatus.INITIATED,
        }),
      );

      // 3. Move funds (Pass the manager!)
      const transfer = await this.ledgerService.postTransfer(
        {
          txId: `FUND-${funding.fundingId}`,
          reference: `Wallet funding for ${dto.walletId}`,
          participantId,
          postedBy: 'system',
          legs: [
            {
              finAddress: this.SYSTEM_POOL_FIN,
              amount: String(dto.amount),
              isCredit: false,
              memo: `Funding wallet ${dto.walletId}`,
            },
            {
              finAddress: wallet.finAddress,
              amount: String(dto.amount),
              isCredit: true,
              memo: `Funded from system pool`,
            },
          ],
        },
        manager,
      );

      // 4. Update status and save
      funding.status = TransactionStatus.COMPLETED;
      await manager.save(funding);

      return {
        fundingId: funding.fundingId,
        status: funding.status,
      };
    });
  }
}
