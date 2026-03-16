import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LoadTransaction } from './entities/load-wallet.entity';
import { WalletService } from 'src/wallet/wallet.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { CardService } from 'src/card/card.service';
import { KycService } from 'src/kyc/kyc.service';
import { LoadWalletDto } from './dto/load-wallet-dto';
import { KycTier } from 'src/common/enums/kyc.enums';
import {
  CardTransaction,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { WalletStatus } from 'src/common/enums/banking.enums';
import { SYSTEM_POOL, TX_PREFIX } from 'src/common/constants';

@Injectable()
export class LoadService {
  constructor(
    @InjectRepository(LoadTransaction)
    private loadRepo: Repository<LoadTransaction>,
    private walletService: WalletService,
    private ledgerService: LedgerService,
    private cardService: CardService,
    private kycService: KycService,
    private dataSource: DataSource,
  ) {}

  async loadWallet(dto: LoadWalletDto, participantId: string) {
    const { idempotencyKey } = dto;

    // 1. Idempotency Check
    const existing = await this.loadRepo.findOne({ where: { idempotencyKey } });
    if (existing && existing.status === CardTransaction.COMPLETED)
      return existing;

    // 2. Pre-Validation (Fetch Wallet & Verify PIN)
    // We use your existing verifyPinWithLock logic via WalletService
    const wallet = await this.walletService.getWallet(
      dto.walletId,
      participantId,
    );
    if (!wallet) throw new NotFoundException('Wallet not found');

    if (wallet.status === WalletStatus.INACTIVE)
      throw new BadRequestException('Wallet is Inactive');

    if (wallet.status === WalletStatus.LOCKED)
      throw new BadRequestException('Wallet is Locked');

    // Use the robust PIN verification you built in WalletService
    await this.walletService.verifyPinWithLock(wallet, participantId, dto.pin);

    await this.kycService.requireTier(wallet.ccuuid, KycTier.SOFT_APPROVED);

    // 3. Get Card (Securely fetch token)
    const card = await this.cardService.getCardSecure(
      participantId,
      dto.cardId,
    );
    if (!card || !card.isActive)
      throw new BadRequestException('Invalid or inactive card');

    if (card.ccuuid !== wallet.ccuuid)
      throw new BadRequestException('Card does not belong to wallet owner');

    // 4. Create Audit Record
    const loadTx = await this.loadRepo.save(
      this.loadRepo.create({
        idempotencyKey,
        participantId,
        ccuuid: wallet.ccuuid,
        walletId: wallet.walletId,
        amount: dto.amount,
        type: TransactionType.CARD_LOAD,
        status: CardTransaction.INITIATED,
      }),
    );

    try {
      // 5. Charge External Gateway
      const gatewayResult = await this.chargeGateway(
        card.token,
        dto.amount,
        idempotencyKey,
      );

      if (!gatewayResult.success) {
        loadTx.status = CardTransaction.FAILED;
        await this.loadRepo.save(loadTx);
        throw new BadRequestException('Card charge failed');
      }

      // 6. Update Internal Ledger (Atomic Transaction)
      return await this.dataSource.transaction(async (manager) => {
        const txId = `${TX_PREFIX.LOAD}-${loadTx.id}`;

        const transferResult = await this.ledgerService.postTransfer(
          {
            txId,
            idempotencyKey: `LEDGER-${idempotencyKey}`,
            reference: `Card load: ${card.brand} - ${card.last4}`,
            participantId,
            postedBy: 'load-service',
            legs: [
              {
                finAddress: SYSTEM_POOL, // System Liability Account
                amount: dto.amount,
                isCredit: false, // DEBIT — money LEAVING the gateway pool
                memo: 'Gateway disbursement to wallet',
              },
              {
                finAddress: wallet.finAddress, // User Wallet Account
                amount: dto.amount,
                isCredit: true, // CREDIT — money ARRIVING at user wallet
                memo: 'Wallet load success',
              },
            ],
          },
          manager,
        );

        if (!transferResult?.journalId) {
          loadTx.status = CardTransaction.FAILED;
          throw new Error('Ledger transfer failed');
        }

        loadTx.status = CardTransaction.COMPLETED;
        loadTx.gatewayRef = gatewayResult.reference;
        return await manager.save(loadTx);
      });
    } catch (error) {
      console.error('CRITICAL: Load failed after gateway charge', error);
      // We don't mark as FAILED here because the gateway might have taken the money.
      // A reconciliation cron job should pick this up.
      throw error;
    }
  }

  private async chargeGateway(token: string, amount: string, key: string) {
    // Simulate API call to Stripe/Paystack/Flutterwave
    await new Promise((r) => setTimeout(r, 100));
    return { success: true, reference: `GTW-${Date.now()}` };
  }
}
