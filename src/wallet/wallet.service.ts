import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import * as crypto from 'crypto';

import { Wallet } from './entities/wallet.entity';
import { WalletLimit } from './entities/wallet-limit.entity';
import { Transaction } from 'src/payments/entities/transaction.entity';

import {
  TransactionType,
  TransactionStatus,
  Currency,
} from 'src/common/enums/transaction.enums';
import { WalletStatus } from 'src/common/enums/banking.enums';
import { AccountType } from 'src/accounts/enums/account.enum';

import { FundWalletDto } from './dto/fund-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';

import { AccountsService } from 'src/accounts/accounts.service';
import { CustomerService } from 'src/customer/customer.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { KycService } from 'src/kyc/kyc.service';
import { KycTier } from 'src/common/enums/kyc.enums';
import { SYSTEM_POOL } from 'src/common/constants';
import { CreateAccountDto } from 'src/accounts/dto/create-account.dto';

@Injectable()
export class WalletService {
  private readonly SYSTEM_POOL_FIN = SYSTEM_POOL;

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(WalletLimit)
    private readonly walletLimitRepo: Repository<WalletLimit>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @Inject(forwardRef(() => CustomerService))
    private readonly customerService: CustomerService,

    private readonly accountsService: AccountsService,
    private readonly ledgerService: LedgerService,
    private readonly kycService: KycService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async createWallet(
    dto: CreateWalletDto,
    participantId: string,
    manager?: EntityManager,
  ): Promise<Wallet> {
    const run = async (txManager: EntityManager): Promise<Wallet> => {
      const walletRepository = txManager.getRepository(Wallet);
      const walletLimitRepository = txManager.getRepository(WalletLimit);

      const existing = await walletRepository.findOne({
        where: { customerId: dto.customerId, participantId },
      });

      if (existing) {
        return existing;
      }

      const finAddress = dto.finAddress?.trim() || `wallet.${dto.customerId}`;

      const wallet = walletRepository.create({
        customerId: dto.customerId,
        participantId,
        finAddress,
        accountId: undefined,
        currency: Currency.SLE,
        pinAttempts: 0,
        status: WalletStatus.ACTIVE,
      } as Partial<Wallet>);

      const savedWallet = await walletRepository.save(wallet);

      const walletAccount = await this.accountsService.createWalletAccount(
        {
          customerId: dto.customerId,
          walletId: savedWallet.walletId,
          participantId,
          currency: Currency.SLE,
          type: AccountType.WALLET,
          finAddress,
          metadata: {
            walletId: savedWallet.walletId,
            customerId: dto.customerId,
          },
        } as CreateAccountDto,
        txManager,
      );

      savedWallet.accountId = walletAccount.accountId;
      await walletRepository.save(savedWallet);

      await walletLimitRepository.save(
        walletLimitRepository.create({
          walletId: savedWallet.walletId,
          dailySendLimit: '10000.00',
          dailyReceiveLimit: '10000.00',
          singleTxLimit: '5000.00',
        }),
      );

      return savedWallet;
    };

    if (manager) {
      return run(manager);
    }

    return this.dataSource.transaction(run);
  }

  async findByCustomer(
    customerId: string,
    participantId: string,
  ): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { customerId, participantId },
    });

    if (!wallet) {
      throw new NotFoundException(
        `Wallet for customer ${customerId} not found`,
      );
    }

    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException(
        `Wallet is ${wallet.status.toLowerCase()}. Only ACTIVE wallets can be used.`,
      );
    }

    return wallet;
  }

  async getWallet(
    walletId: string,
    participantId: string,
  ): Promise<Wallet | null> {
    return this.walletRepo.findOne({
      where: { walletId, participantId },
    });
  }

  async findByFinAddress(
    finAddress: string,
    participantId?: string,
  ): Promise<Wallet | null> {
    return this.walletRepo.findOne({
      where: participantId ? { finAddress, participantId } : { finAddress },
    });
  }

  async getWalletByFinAddress(
    finAddress: string,
    participantId?: string,
  ): Promise<Wallet> {
    const wallet = await this.findByFinAddress(finAddress, participantId);

    if (!wallet) {
      throw new NotFoundException('Receiver wallet not found');
    }

    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException('Receiver wallet not active');
    }

    return wallet;
  }

  async getBalance(walletId: string, participantId: string) {
    const wallet = await this.validateActiveWallet(walletId, participantId);

    const account = await this.resolveWalletAccount(wallet);

    const balance = await this.ledgerService.getDerivedBalance(
      account.finAddress,
      participantId,
    );

    return {
      walletId: wallet.walletId,
      accountId: wallet.accountId,
      customerId: wallet.customerId,
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
      take: 50,
    });
  }

  async fundWallet(dto: FundWalletDto, participantId: string) {
    const wallet = await this.validateActiveWallet(dto.walletId, participantId);
    const walletAccount = await this.resolveWalletAccount(wallet);

    await this.kycService.requireTier(
      wallet.customerId,
      participantId,
      KycTier.SOFT_APPROVED,
    );
    await this.verifyPinWithLock(wallet, participantId, dto.pin);

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    const amountStr = amount.toFixed(2);
    const sourceFinAddress =
      dto.sourceFinAddress?.trim() || this.SYSTEM_POOL_FIN;
    const txId = `WFUND-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      await this.accountsService.assertFinAddressActive(
        sourceFinAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        walletAccount.finAddress,
        manager,
      );

      const transferResult = await this.ledgerService.postTransfer(
        {
          txId,
          idempotencyKey: dto.idempotencyKey,
          reference: `Wallet funding ${wallet.walletId}`,
          participantId,
          postedBy: 'wallet-service',
          currency: wallet.currency,
          legs: [
            {
              finAddress: sourceFinAddress,
              amount: amountStr,
              isCredit: false,
              memo: `Wallet funding source -> ${wallet.finAddress}`,
            },
            {
              finAddress: walletAccount.finAddress,
              amount: amountStr,
              isCredit: true,
              memo: `Wallet funded from ${sourceFinAddress}`,
            },
          ],
        },
        manager,
      );

      if (transferResult.status === 'already_processed') {
        const newBalance = await this.ledgerService.getDerivedBalance(
          wallet.finAddress,
          participantId,
        );
        return {
          status: 'success',
          journalId: transferResult.journalId,
          txId: transferResult.txId,
          newBalance,
        };
      }

      await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          participantId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: sourceFinAddress,
          receiverAlias: wallet.customerId,
          senderFinAddress: sourceFinAddress,
          receiverFinAddress: wallet.finAddress,
          amount: Number(amountStr),
          currency: wallet.currency,
          status: TransactionStatus.COMPLETED,
          reference: `Wallet Funding ${txId}`,
        }),
      );

      const newBalance = await this.ledgerService.getDerivedBalance(
        wallet.finAddress,
        participantId,
      );

      return {
        status: 'success',
        journalId: transferResult.journalId,
        txId,
        newBalance,
      };
    });
  }

  async withdrawWallet(dto: WithdrawWalletDto, participantId: string) {
    const wallet = await this.validateActiveWallet(dto.walletId, participantId);
    const walletAccount = await this.resolveWalletAccount(wallet);

    await this.kycService.requireTier(
      wallet.customerId,
      participantId,
      KycTier.HARD_APPROVED,
    );
    await this.verifyPinWithLock(wallet, participantId, dto.pin);

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    const amountStr = amount.toFixed(2);
    const destinationFinAddress =
      dto.destinationFinAddress?.trim() || this.SYSTEM_POOL_FIN;
    const txId = `WWD-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      await this.accountsService.assertFinAddressActive(
        walletAccount.finAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        destinationFinAddress,
        manager,
      );

      const transferResult = await this.ledgerService.postTransfer(
        {
          txId,
          idempotencyKey: dto.idempotencyKey,
          reference: `Wallet withdrawal ${wallet.walletId}`,
          participantId,
          postedBy: 'wallet-service',
          currency: wallet.currency,
          legs: [
            {
              finAddress: walletAccount.finAddress,
              amount: amountStr,
              isCredit: false,
              memo: `Wallet withdrawal -> ${destinationFinAddress}`,
            },
            {
              finAddress: destinationFinAddress,
              amount: amountStr,
              isCredit: true,
              memo: `Wallet withdrawal from ${wallet.finAddress}`,
            },
          ],
        },
        manager,
      );

      if (transferResult.status === 'already_processed') {
        const newBalance = await this.ledgerService.getDerivedBalance(
          wallet.finAddress,
          participantId,
        );
        return {
          status: 'success',
          journalId: transferResult.journalId,
          txId: transferResult.txId,
          newBalance,
        };
      }

      await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          participantId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: wallet.customerId,
          receiverAlias: destinationFinAddress,
          senderFinAddress: wallet.finAddress,
          receiverFinAddress: destinationFinAddress,
          amount: Number(amountStr),
          currency: wallet.currency,
          status: TransactionStatus.COMPLETED,
          reference: `Wallet Withdrawal ${txId}`,
        }),
      );

      const newBalance = await this.ledgerService.getDerivedBalance(
        wallet.finAddress,
        participantId,
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
    const receiver = await this.getWalletByFinAddress(dto.receiverFinAddress);

    const senderAccount = await this.resolveWalletAccount(sender);
    const receiverAccount = await this.resolveWalletAccount(receiver);

    await this.verifyPinWithLock(sender, participantId, dto.pin);

    if (sender.walletId === receiver.walletId) {
      throw new BadRequestException('Cannot send to yourself');
    }

    const amount = new Decimal(dto.amount);
    if (amount.isNaN() || amount.lte(0)) {
      throw new BadRequestException('Invalid amount');
    }

    if (amount.gt(5000)) {
      await this.kycService.requireTier(
        sender.customerId,
        participantId,
        KycTier.HARD_APPROVED,
      );
    } else {
      await this.kycService.requireTier(
        sender.customerId,
        participantId,
        KycTier.SOFT_APPROVED,
      );
    }

    const amountStr = amount.toFixed(2);
    const txId = `WTRF-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      await this.accountsService.assertFinAddressActive(
        senderAccount.finAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        receiverAccount.finAddress,
        manager,
      );

      const senderLimit = await manager.getRepository(WalletLimit).findOne({
        where: { walletId: sender.walletId },
      });

      if (senderLimit) {
        const dailySent = await this.calculateDailySent(
          manager,
          senderAccount.finAddress,
        );
        const newDailySent = new Decimal(dailySent).add(amount);

        if (newDailySent.gt(senderLimit.dailySendLimit)) {
          throw new BadRequestException('Daily send limit exceeded');
        }

        if (amount.gt(senderLimit.singleTxLimit)) {
          throw new BadRequestException(
            'Amount exceeds single transaction limit',
          );
        }
      }

      const receiverLimit = await manager.getRepository(WalletLimit).findOne({
        where: { walletId: receiver.walletId },
      });

      if (receiverLimit) {
        const dailyReceived = await this.calculateDailyReceived(
          manager,
          receiver.finAddress,
        );
        const newDailyReceived = new Decimal(dailyReceived).add(amount);

        if (newDailyReceived.gt(receiverLimit.dailyReceiveLimit)) {
          throw new BadRequestException(
            'Receiver daily receive limit exceeded',
          );
        }
      }

      const transferResult = await this.ledgerService.postTransfer(
        {
          txId,
          idempotencyKey: dto.idempotencyKey,
          reference: `Wallet to wallet ${txId}`,
          participantId,
          postedBy: 'wallet-service',
          currency: sender.currency,
          legs: [
            {
              finAddress: senderAccount.finAddress,
              amount: amountStr,
              isCredit: false,
              memo: `Wallet transfer to ${receiver.finAddress}`,
            },
            {
              finAddress: receiverAccount.finAddress,
              amount: amountStr,
              isCredit: true,
              memo: `Wallet transfer from ${sender.finAddress}`,
            },
          ],
        },
        manager,
      );

      if (transferResult.status === 'already_processed') {
        const senderNewBalance = await this.ledgerService.getDerivedBalance(
          senderAccount.finAddress,
          participantId,
        );

        return {
          status: 'success',
          journalId: transferResult.journalId,
          txId: transferResult.txId,
          senderNewBalance,
        };
      }

      await manager.getRepository(Transaction).save(
        manager.getRepository(Transaction).create({
          participantId,
          channel: TransactionType.CREDIT_TRANSFER,
          senderAlias: sender.customerId,
          receiverAlias: receiver.customerId,
          senderFinAddress: sender.finAddress,
          receiverFinAddress: receiver.finAddress,
          amount: Number(amountStr),
          currency: sender.currency,
          status: TransactionStatus.COMPLETED,
          reference: `Wallet P2P ${txId}`,
        }),
      );

      const senderNewBalance = await this.ledgerService.getDerivedBalance(
        senderAccount.finAddress,
        participantId,
      );

      return {
        status: 'success',
        journalId: transferResult.journalId,
        txId,
        senderNewBalance,
      };
    });
  }

  async updateWalletStatus(
    walletId: string,
    participantId: string,
    status: WalletStatus,
  ): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { walletId, participantId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    wallet.status = status;
    return this.walletRepo.save(wallet);
  }

  async verifyPinWithLock(
    wallet: Wallet,
    participantId: string,
    pin: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const lockedWallet = await manager
        .createQueryBuilder(Wallet, 'wallet')
        .where('wallet.walletId = :walletId', {
          walletId: wallet.walletId,
        })
        .andWhere('wallet.participantId = :participantId', {
          participantId,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!lockedWallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (lockedWallet.status === WalletStatus.LOCKED) {
        throw new BadRequestException(
          'Wallet is locked. Contact support to unlock.',
        );
      }

      let pinValid = false;

      try {
        await this.customerService.verifyPin(
          lockedWallet.customerId,
          participantId,
          pin,
        );
        pinValid = true;
      } catch {
        lockedWallet.pinAttempts = (lockedWallet.pinAttempts ?? 0) + 1;

        if (lockedWallet.pinAttempts >= 3) {
          lockedWallet.status = WalletStatus.LOCKED;
        }

        await manager.save(lockedWallet);

        throw new BadRequestException(
          `Invalid PIN. Attempt ${lockedWallet.pinAttempts}/3${
            lockedWallet.status === WalletStatus.LOCKED
              ? '. Wallet locked.'
              : ''
          }`,
        );
      }

      if (pinValid) {
        if (lockedWallet.pinAttempts !== 0) {
          lockedWallet.pinAttempts = 0;
          await manager.save(lockedWallet);
        }
      }
    });
  }

  private async validateActiveWallet(
    walletId: string,
    participantId: string,
  ): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({
      where: { walletId, participantId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException(
        `Wallet is ${wallet.status.toLowerCase()}. Only ACTIVE wallets can perform operations.`,
      );
    }

    return wallet;
  }

  private async resolveWalletAccount(wallet: Wallet, manager?: EntityManager) {
    if (!wallet.accountId)
      throw new NotFoundException('Wallet account missing');
    return this.accountsService.findById(wallet.accountId, manager);
  }

  private async calculateDailySent(
    manager: EntityManager,
    finAddress: string,
  ): Promise<string> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await manager
      .getRepository(Transaction)
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.senderFinAddress = :finAddress', { finAddress })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :startOfDay', { startOfDay })
      .getRawOne<{ total: string }>();

    return result?.total ?? '0';
  }

  private async calculateDailyReceived(
    manager: EntityManager,
    finAddress: string,
  ): Promise<string> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await manager
      .getRepository(Transaction)
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.receiverFinAddress = :finAddress', { finAddress })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :startOfDay', { startOfDay })
      .getRawOne<{ total: string }>();

    return result?.total ?? '0';
  }
}
