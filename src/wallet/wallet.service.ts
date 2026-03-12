import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import * as crypto from 'crypto';
import { Decimal } from 'decimal.js';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from 'src/payments/entities/transaction.entity';
import {
  TransactionType,
  TransactionStatus,
  Currency,
} from 'src/common/enums/transaction.enums';
import { WalletStatus } from 'src/common/enums/banking.enums';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { AccountsService } from 'src/accounts/accounts.service';
import { CustomerService } from 'src/customer/customer.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { SYSTEM_POOL_FIN_ADDRESS } from 'src/common/constants';
import { WalletLimit } from './entities/wallet-limit.entity';
import { KycService } from 'src/kyc/kyc.service';
import { KycTier } from 'src/common/enums/kyc.enums';

@Injectable()
export class WalletService {
  private readonly SYSTEM_POOL_FIN = SYSTEM_POOL_FIN_ADDRESS;

  constructor(
    @InjectRepository(Wallet)
    private wallRepo: Repository<Wallet>,

    @InjectRepository(WalletLimit)
    private limitRepo: Repository<WalletLimit>,

    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,

    @Inject(forwardRef(() => CustomerService))
    private customerService: CustomerService,

    private accService: AccountsService,
    private ledgerService: LedgerService,
    private kycService: KycService,

    private dataSource: DataSource,
  ) {
    Decimal.set({ precision: 18, rounding: Decimal.ROUND_HALF_UP });
  }

  async createWallet(
    ccuuid: string,
    participantId: string,
    manager?: EntityManager,
  ): Promise<Wallet> {
    const walletRepo = manager ? manager.getRepository(Wallet) : this.wallRepo;

    const finAddress = `WALLET-${ccuuid}`;

    if (await walletRepo.findOne({ where: { finAddress } })) {
      throw new BadRequestException('Wallet already exists');
    }

    const wallet = walletRepo.create({
      ccuuid,
      participantId,
      finAddress,
      currency: Currency.SLE,
      status: WalletStatus.ACTIVE,
      pinAttempts: 0,
    });

    const saved = await walletRepo.save(wallet);

    await this.accService.create(
      participantId,
      {
        finAddress,
        currency: Currency.SLE,
      },
      manager,
    );

    //  add limit id matches wallet and wallet limit repo

    return saved;
  }

  async getBalance(walletId: string, participantId: string) {
    const wallet = await this.validateActiveWallet(walletId, participantId);

    const balance = await this.ledgerService.getDerivedBalance(
      wallet.finAddress,
    );

    return {
      walletId: wallet.walletId,
      balance,
      currency: wallet.currency,
      status: wallet.status,
    };
  }

  async getHistory(walletId: string, participantId: string) {
    const wallet = await this.validateActiveWallet(walletId, participantId);

    return this.txRepo.find({
      where: [
        { senderFinAddress: wallet.finAddress, participantId },
        { receiverFinAddress: wallet.finAddress, participantId },
      ],
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async fundWallet(
    dto: FundWalletDto & { idempotencyKey?: string },
    participantId: string,
  ) {
    const wallet = await this.validateActiveWallet(dto.walletId, participantId);

    await this.kycService.requireTier(wallet.ccuuid, KycTier.SOFT_APPROVED);

    await this.verifyPinWithLock(wallet, participantId, dto.pin);

    const amount = new Decimal(dto.amount);

    if (amount.isNaN() || amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Invalid amount');
    }
    const amountStr = amount.toFixed(2);

    const txId = `FUND-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    return this.dataSource.transaction(async (manager) => {
      const transferResult = await this.ledgerService.postTransfer({
        txId,
        idempotencyKey: dto.idempotencyKey,
        reference: 'Wallet funding from system pool',
        participantId,
        postedBy: 'wallet-service',
        legs: [
          {
            finAddress: this.SYSTEM_POOL_FIN,
            amount: amountStr,
            isCredit: true, // debit system
            memo: `Funded ${wallet.finAddress}`,
          },
          {
            finAddress: wallet.finAddress,
            amount: amountStr,
            isCredit: false, // credit wallet
            memo: 'Funding from system pool',
          },
        ],
      });

      if (transferResult.status === 'already_processed') {
        return { ...transferResult, message: 'Already processed' };
      }

      await manager.getRepository(Transaction).save(
        manager.create(Transaction, {
          participantId: wallet.participantId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: 'SYSTEM_POOL',
          receiverAlias: wallet.ccuuid,
          senderFinAddress: this.SYSTEM_POOL_FIN,
          receiverFinAddress: wallet.finAddress,
          amount: Number(amountStr),
          currency: wallet.currency,
          status: TransactionStatus.COMPLETED,
          reference: 'Wallet Funding',
        }),
      );

      const newBalance = await this.ledgerService.getDerivedBalance(
        wallet.finAddress,
      );

      return {
        status: 'success',
        journalId: transferResult.journalId,
        txId,
        newBalance,
      };
    });
  }

  async withdrawWallet(
    dto: WithdrawWalletDto & { idempotencyKey?: string },
    participantId: string,
  ) {
    const wallet = await this.validateActiveWallet(dto.walletId, participantId);

    await this.kycService.requireTier(wallet.ccuuid, KycTier.HARD_APPROVED);

    await this.verifyPinWithLock(wallet, participantId, dto.pin);

    const amount = new Decimal(dto.amount);

    if (amount.isNaN() || amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Invalid amount');
    }

    const amountStr = amount.toFixed(2);

    return this.dataSource.transaction(async (manager) => {
      // Balance check inside transaction
      const currentStr = await this.ledgerService.getDerivedBalance(
        wallet.finAddress,
      );
      const current = new Decimal(currentStr);

      if (current.lessThan(amount)) {
        throw new BadRequestException(
          `Insufficient balance: ${current.toFixed(2)}`,
        );
      }

      const txId = `WD-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const transferResult = await this.ledgerService.postTransfer({
        txId,
        idempotencyKey: dto.idempotencyKey,
        reference: 'Wallet withdrawal to system pool',
        participantId,
        postedBy: 'wallet-service',
        legs: [
          {
            finAddress: wallet.finAddress,
            amount: amountStr,
            isCredit: true, // debit wallet
            memo: `Withdrawal to system`,
          },
          {
            finAddress: this.SYSTEM_POOL_FIN,
            amount: amountStr,
            isCredit: false, // credit system
            memo: `Withdrawal from ${wallet.finAddress}`,
          },
        ],
      });

      if (transferResult.status === 'already_processed') {
        return { ...transferResult, message: 'Already processed' };
      }

      await manager.getRepository(Transaction).save(
        manager.create(Transaction, {
          participantId: wallet.participantId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: wallet.ccuuid,
          receiverAlias: 'SYSTEM_POOL',
          senderFinAddress: wallet.finAddress,
          receiverFinAddress: this.SYSTEM_POOL_FIN,
          amount: Number(amountStr),
          currency: wallet.currency,
          status: TransactionStatus.COMPLETED,
          reference: 'Wallet Withdrawal',
        }),
      );

      const newBalance = await this.ledgerService.getDerivedBalance(
        wallet.finAddress,
      );

      return {
        status: 'success',
        journalId: transferResult.journalId,
        txId,
        newBalance,
      };
    });
  }

  async transferWallet(dto: TransferWalletDto, participantId: string) {
    const sender = await this.validateActiveWallet(
      dto.senderWalletId,
      participantId,
    );

    await this.verifyPinWithLock(sender, participantId, dto.pin);

    const receiver = await this.getWalletByFinAddress(dto.receiverFinAddress);

    if (sender.walletId === receiver.walletId) {
      throw new BadRequestException('Cannot send to yourself');
    }

    const amount = new Decimal(dto.amount);

    if (amount.gt(5000)) {
      await this.kycService.requireTier(sender.ccuuid, KycTier.HARD_APPROVED);
    } else {
      await this.kycService.requireTier(sender.ccuuid, KycTier.SOFT_APPROVED);
    }

    if (amount.isNaN() || amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Invalid amount');
    }

    const amountStr = amount.toFixed(2);

    return this.dataSource.transaction(async (manager) => {
      // Balance check inside transaction
      const senderBalStr = await this.ledgerService.getDerivedBalance(
        sender.finAddress,
      );
      const senderBal = new Decimal(senderBalStr);

      if (senderBal.lessThan(amount)) {
        throw new BadRequestException(
          `Insufficient balance: ${senderBal.toFixed(2)}`,
        );
      }
      const limit = await manager.getRepository(WalletLimit).findOne({
        where: { walletId: sender.walletId },
      });

      if (limit) {
        const dailySent = await this.calculateDailySent(
          manager,
          sender.finAddress,
        );
        const newDaily = new Decimal(dailySent).add(amount);

        if (newDaily.gt(limit.dailySendLimit)) {
          throw new BadRequestException('Daily send limit exceeded');
        }

        if (amount.gt(limit.singleTxLimit)) {
          throw new BadRequestException(
            'Amount exceeds single transaction limit',
          );
        }
      }

      const txId = `TRF-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

      const transferResult = await this.ledgerService.postTransfer({
        txId,
        idempotencyKey: dto.idempotencyKey,
        reference: `Wallet-to-wallet ${txId}`,
        participantId,
        postedBy: 'wallet-service',
        legs: [
          {
            finAddress: sender.finAddress,
            amount: amountStr,
            isCredit: true,
            memo: `Sent to ${receiver.ccuuid}`,
          },
          {
            finAddress: receiver.finAddress,
            amount: amountStr,
            isCredit: false,
            memo: `Received from ${sender.ccuuid}`,
          },
        ],
      });

      if (transferResult.status === 'already_processed') {
        return { ...transferResult, message: 'Already processed' };
      }

      await manager.getRepository(Transaction).save(
        manager.create(Transaction, {
          participantId: sender.participantId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: sender.ccuuid,
          receiverAlias: receiver.ccuuid,
          senderFinAddress: sender.finAddress,
          receiverFinAddress: receiver.finAddress,
          amount: Number(amountStr),
          currency: sender.currency,
          status: TransactionStatus.COMPLETED,
          reference: `P2P ${txId}`,
        }),
      );

      const [sNew, rNew] = await Promise.all([
        this.ledgerService.getDerivedBalance(sender.finAddress),
        this.ledgerService.getDerivedBalance(receiver.finAddress),
      ]);

      return {
        status: 'success',
        journalId: transferResult.journalId,
        txId,
        senderNewBalance: sNew,
        receiverNewBalance: rNew,
      };
    });
  }

  async getWallet(
    walletId: string,
    participantId: string,
  ): Promise<Wallet | null> {
    return this.wallRepo.findOne({
      where: { walletId, participantId },
    });
  }

  public async verifyPinWithLock(
    wallet: Wallet,
    participantId: string,
    pin: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Lock the wallet row (pessimistic write) — only one request can proceed
      const lockedWallet = await manager
        .createQueryBuilder(Wallet, 'wallet')
        .where('wallet.walletId = :id AND wallet.participantId = :pid', {
          id: wallet.walletId,
          pid: participantId,
        })
        .setLock('pessimistic_write') // ← THIS IS THE FIX
        .getOne();

      if (!lockedWallet) throw new NotFoundException('Wallet not found');

      if (lockedWallet.status === WalletStatus.LOCKED) {
        throw new BadRequestException(
          'Wallet is locked. Contact support to unlock.',
        );
      }

      try {
        await this.customerService.verifyPin(
          lockedWallet.ccuuid,
          participantId,
          pin,
        );
        lockedWallet.pinAttempts = 0;
      } catch {
        lockedWallet.pinAttempts = (lockedWallet.pinAttempts ?? 0) + 1;
        if (lockedWallet.pinAttempts >= 3) {
          lockedWallet.status = WalletStatus.LOCKED;
        }
        throw new BadRequestException(
          `Invalid PIN. Attempt ${lockedWallet.pinAttempts}/3` +
            (lockedWallet.status === WalletStatus.LOCKED
              ? '. Wallet locked.'
              : ''),
        );
      }

      await manager.save(lockedWallet);
    });
  }
  private async calculateDailySent(
    manager: EntityManager,
    finAddress: string,
  ): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight of the current day

    const result = await manager
      .getRepository(Transaction)
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'total')
      .where('tx.senderFinAddress = :finAddress', { finAddress })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :startOfDay', { startOfDay: today })
      .getRawOne();

    // TypeORM SUM returns a string for decimal columns in most SQL dialects
    return result?.total || '0';
  }

  private async validateActiveWallet(
    walletId: string,
    participantId: string,
  ): Promise<Wallet> {
    const wallet = await this.wallRepo.findOne({
      where: { walletId, participantId },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');

    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException(
        `Wallet is ${wallet.status.toLowerCase()}. Only ACTIVE wallets can perform operations.`,
      );
    }

    return wallet;
  }

  async getWalletByFinAddress(finAddress: string): Promise<Wallet> {
    const wallet = await this.wallRepo.findOne({
      where: { finAddress },
    });

    if (!wallet) throw new NotFoundException('Receiver wallet not found');

    if (wallet.status !== WalletStatus.ACTIVE)
      throw new BadRequestException('Receiver wallet not active');

    return wallet;
  }
}
