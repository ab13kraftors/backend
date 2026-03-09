import {
  BadRequestException,
  forwardRef,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { Repository } from 'typeorm';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { WithdrawWalletDto } from './dto/withdraw-wallet.dto';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletStatus } from 'src/common/enums/banking.enums';
import {
  TransactionType,
  TransactionStatus,
  Currency,
} from 'src/common/enums/transaction.enums';
import { Transaction } from 'src/payments/entities/transaction.entity';
import { TransferWalletDto } from './dto/transfer-wallet.dto';
import { CustomerService } from 'src/customer/customer.service';

@Injectable()
export class WalletService {
  // Internal system account used as liquidity pool
  private readonly SYSTEM_POOL_FIN = 'SYSTEM_INTERNAL'; // Testing

  constructor(
    // Inject Wallet repository
    @InjectRepository(Wallet) private wallRepo: Repository<Wallet>,

    // Inject Transaction repository
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,

    // Inject Accounts service for ledger transfers
    private accService: AccountsService,

    // Inject Customer service (forwardRef to avoid circular dependency)
    @Inject(forwardRef(() => CustomerService))
    private customerService: CustomerService,
  ) {}

  // ================== createWallet ==================
  // Creates wallet and corresponding ledger account
  async createWallet(ccuuid: string, participantId: string) {
    const finAddress = `WALLET-${ccuuid}`;

    const myWallet = this.wallRepo.create({
      ccuuid,
      participantId,
      finAddress,
      currency: Currency.SLE,
      balance: 0,
      status: WalletStatus.ACTIVE,
    });

    const saved = await this.wallRepo.save(myWallet);

    // Create corresponding ledger account
    await this.accService.create(participantId, {
      finAddress,
      currency: Currency.SLE,
      balance: 0,
      participantId,
    });

    return saved;
  }

  // ================== getBalance ==================
  // Returns wallet balance
  async getBalance(walletId: string, participantId: string) {
    const myWallet = await this.wallRepo.findOne({
      where: { walletId, participantId },
    });

    if (!myWallet) throw new NotFoundException('Wallet does not exists!!');

    return {
      walletId: myWallet.walletId,
      balance: myWallet.balance,
      currency: myWallet.currency,
      status: myWallet.status,
    };
  }

  // ================== getHistory ==================
  // Returns last 20 wallet transactions
  async getHistory(walletId: string, participantId: string) {
    const myWallet = await this.wallRepo.findOne({
      where: { walletId, participantId },
    });

    if (!myWallet) throw new NotFoundException('Wallet does not exists!!');

    return this.txRepo.find({
      where: [
        { senderFinAddress: myWallet.finAddress, participantId },
        { receiverFinAddress: myWallet.finAddress, participantId },
      ],
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  // ================== fundWallet ==================
  // Adds money from system pool to wallet
  async fundWallet(dto: FundWalletDto, participantId: string) {
    const myWallet = await this.wallRepo.findOne({
      where: { walletId: dto.walletId, participantId },
    });

    if (!myWallet) throw new NotFoundException('Wallet does not exists!!');

    // Verify PIN before funding
    await this.verifyPinWithLock(myWallet, participantId, dto.pin);

    const txId = `FUND-${Date.now()}`;

    // Ledger transfer (System → Wallet)
    await this.accService.transfer(
      txId,
      this.SYSTEM_POOL_FIN,
      myWallet.finAddress,
      dto.amount,
    );

    // Record transaction
    await this.txRepo.save(
      this.txRepo.create({
        participantId: myWallet.participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        senderAlias: 'SYSTEM_POOL',
        receiverAlias: myWallet.ccuuid,
        senderFinAddress: this.SYSTEM_POOL_FIN,
        receiverFinAddress: myWallet.finAddress,
        amount: dto.amount,
        currency: myWallet.currency,
        status: TransactionStatus.COMPLETED,
        reference: 'Wallet Funding',
      }),
    );

    // Update wallet balance
    myWallet.balance = Number(myWallet.balance) + dto.amount;

    return this.wallRepo.save(myWallet);
  }

  // ================== withdrawWallet ==================
  // Withdraws money from wallet to system pool
  async withdrawWallet(dto: WithdrawWalletDto, participantId: string) {
    const myWallet = await this.wallRepo.findOne({
      where: { walletId: dto.walletId, participantId },
    });
    if (!myWallet) throw new NotFoundException('Wallet not found');

    // Verify PIN with lock handling
    await this.verifyPinWithLock(myWallet, participantId, dto.pin);

    // Check wallet balance
    if (Number(myWallet.balance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const txId = `WITHDRAW-${Date.now()}`;

    // Ledger transfer (Wallet → System)
    await this.accService.transfer(
      txId,
      myWallet.finAddress,
      this.SYSTEM_POOL_FIN,
      dto.amount,
    );

    // Log transaction
    await this.txRepo.save(
      this.txRepo.create({
        participantId: myWallet.participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        senderAlias: myWallet.ccuuid,
        receiverAlias: 'SYSTEM_POOL',
        senderFinAddress: myWallet.finAddress,
        receiverFinAddress: this.SYSTEM_POOL_FIN,
        amount: dto.amount,
        currency: myWallet.currency,
        status: TransactionStatus.COMPLETED,
        reference: 'Wallet Withdrawal',
      }),
    );

    // Update wallet balance
    myWallet.balance = Number(myWallet.balance) - dto.amount;

    return this.wallRepo.save(myWallet);
  }

  // ================== transferWallet ==================
  // Transfers funds between two wallets
  async transferWallet(dto: TransferWalletDto, participantId: string) {
    // Sender wallet
    const sender = await this.wallRepo.findOne({
      where: { walletId: dto.senderWalletId, participantId },
    });
    if (!sender) throw new NotFoundException('Sender wallet not found');

    // Verify PIN with lock handling
    await this.verifyPinWithLock(sender, participantId, dto.pin);

    // Receiver wallet by finAddress
    const receiver = await this.wallRepo.findOne({
      where: { finAddress: dto.receiverFinAddress },
    });
    if (!receiver) throw new NotFoundException('Receiver wallet not found');

    // Prevent self-transfer
    if (sender.walletId === receiver.walletId) {
      throw new BadRequestException('Cannot transfer to your own wallet');
    }

    // Check sender balance
    if (Number(sender.balance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const txId = `TRANSFER-${Date.now()}`;

    // Ledger transfer (Wallet → Wallet)
    await this.accService.transfer(
      txId,
      sender.finAddress,
      receiver.finAddress,
      dto.amount,
    );

    // Record transaction
    await this.txRepo.save(
      this.txRepo.create({
        participantId: sender.participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        senderAlias: sender.ccuuid,
        receiverAlias: receiver.ccuuid,
        senderFinAddress: sender.finAddress,
        receiverFinAddress: receiver.finAddress,
        amount: dto.amount,
        currency: sender.currency,
        status: TransactionStatus.COMPLETED,
        reference: `Wallet Transfer ${txId}`,
      }),
    );

    // Update wallet balances
    sender.balance = Number(sender.balance) - dto.amount;
    receiver.balance = Number(receiver.balance) + dto.amount;

    await this.wallRepo.save(sender);
    await this.wallRepo.save(receiver);

    return {
      txId,
      senderBalance: sender.balance,
      receiverBalance: receiver.balance,
    };
  }

  // ================== Private PIN Verification ==================
  private async verifyPinWithLock(
    myWallet: Wallet,
    participantId: string,
    pin: string,
  ): Promise<void> {
    try {
      await this.customerService.verifyPin(myWallet.ccuuid, participantId, pin);

      // Reset attempts on success
      myWallet.pinAttempts = 0;
      await this.wallRepo.save(myWallet);
    } catch (error) {
      // Increase attempt counter
      myWallet.pinAttempts = (myWallet.pinAttempts ?? 0) + 1;

      // Lock wallet after 3 failed attempts
      if (myWallet.pinAttempts >= 3) {
        myWallet.status = WalletStatus.LOCKED;
      }

      await this.wallRepo.save(myWallet);

      if (myWallet.status === WalletStatus.LOCKED) {
        throw new BadRequestException(
          'Wallet locked due to multiple incorrect PIN attempts',
        );
      }

      throw new BadRequestException(
        `Invalid PIN. Attempt ${myWallet.pinAttempts}/3 and 
        ${error}`,
      );
    }
  }
}
