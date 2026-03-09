// src/payments/funding/funding.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FundingWallet } from './entities/funding.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { FundingWalletDto } from './dto/fund-wallet.dto';
import { TransactionStatus } from 'src/common/enums/transaction.enums';
import { AccountsService } from 'src/accounts/accounts.service';

@Injectable()
export class FundingService {
  // System internal pool account used for funding
  private readonly SYSTEM_POOL_FIN = 'SYSTEM_INTERNAL';

  constructor(
    // Inject Funding repository
    @InjectRepository(FundingWallet)
    private fundingRepo: Repository<FundingWallet>,

    // Inject Wallet repository
    @InjectRepository(Wallet)
    private walletRepo: Repository<Wallet>,

    // Inject Accounts service for ledger transfers
    private readonly accService: AccountsService,
  ) {}

  // ================== fundingWallet ==================
  // Funds a wallet from the system pool
  async fundingWallet(participantId: string, dto: FundingWalletDto) {
    // Find wallet belonging to participant
    const wallet = await this.walletRepo.findOne({
      where: { walletId: dto.walletId, participantId },
    });

    if (!wallet)
      throw new NotFoundException('Wallet does not exist or access denied');

    // Create funding record
    const funding = await this.fundingRepo.save(
      this.fundingRepo.create({
        ...dto,
        participantId,
        status: TransactionStatus.COMPLETED, // funding immediately completed
      }),
    );

    // Move funds in ledger (System → Wallet)
    await this.accService.transfer(
      `FUND-${funding.fundingId}`,
      this.SYSTEM_POOL_FIN,
      wallet.finAddress,
      dto.amount,
    );

    // Update wallet balance
    wallet.balance = Number(wallet.balance) + Number(dto.amount);
    await this.walletRepo.save(wallet);

    return {
      fundingId: funding.fundingId,
      walletBalance: wallet.balance,
      status: funding.status,
    };
  }
}
