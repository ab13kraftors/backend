import {
  BadRequestException,
  Injectable,
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
@Injectable()
export class WalletService {
  private readonly SYSTEM_POOL_FIN = 'SYSTEM_INTERNAL';

  constructor(
    @InjectRepository(Wallet) private wallRepo: Repository<Wallet>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    private accService: AccountsService,
  ) {}

  // ==========Create Wallet==============
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

    await this.accService.create(participantId, {
      finAddress,
      currency: Currency.SLE,
      balance: 0,
      participantId,
    });

    return saved;
  }

  // ==========Get Balance==============
  async getBalance(walletId: string, participantId: string) {
    const myWallet = await this.wallRepo.findOne({
      where: { walletId, participantId },
    });

    if (!myWallet) throw new NotFoundException('Wallet does not exists!!');

    return {
      walletId: myWallet.walletId,
      balance: myWallet.balance,
      currency: myWallet.currency,
    };
  }

  // ==========Get History==============
  async getHistory(walletId: string, participantId: string) {
    const myWallet = await this.wallRepo.findOne({
      where: { walletId, participantId },
    });

    if (!myWallet) throw new NotFoundException('Wallet does not exists!!');

    return this.txRepo.find({
      where: [
        { senderFinAddress: myWallet.finAddress, participantId },
        { receiverFinAddress: myWallet.finAddress, participantId },
        // Also check by walletId if you logged it that way
        { senderFinAddress: myWallet.walletId, participantId },
        { receiverFinAddress: myWallet.walletId, participantId },
      ],
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  // ==========Fund Wallet==============
  async fundWallet(dto: FundWalletDto, participantId: string) {
    const myWallet = await this.wallRepo.findOne({
      where: { walletId: dto.walletId, participantId },
    });

    if (!myWallet) throw new NotFoundException('Wallet does not exists!!');

    const txId = `FUND-${Date.now()}`;

    await this.accService.transfer(
      txId,
      this.SYSTEM_POOL_FIN,
      myWallet.finAddress,
      dto.amount,
    );

    await this.txRepo.save(
      this.txRepo.create({
        participantId: myWallet.participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        senderAlias: 'SYSTEM_POOL',
        receiverAlias: myWallet.ccuuid,
        senderFinAddress: 'SYSTEM',
        receiverFinAddress: myWallet.finAddress,
        amount: dto.amount,
        currency: myWallet.currency,
        status: TransactionStatus.COMPLETED,
        reference: 'Wallet Funding',
      }),
    );

    myWallet.balance = Number(myWallet.balance) + dto.amount;

    return this.wallRepo.save(myWallet);
  }

  // ==========Withdraw From Wallet==============
  async withdrawWallet(dto: WithdrawWalletDto, participantId: string) {
    const myWallet = await this.wallRepo.findOne({
      where: { walletId: dto.walletId, participantId },
    });
    if (!myWallet) throw new NotFoundException('Wallet not found');

    if (Number(myWallet.balance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // 1. Ledger Move (Debit User, Credit Bank/System)
    const txId = `WITHDRAW-${Date.now()}`;

    await this.accService.transfer(
      txId,
      myWallet.finAddress,
      this.SYSTEM_POOL_FIN,
      dto.amount,
    );

    // 2. Log Transaction
    await this.txRepo.save(
      this.txRepo.create({
        participantId: myWallet.participantId,
        channel: TransactionType.CREDIT_TRANSFER,
        senderAlias: myWallet.ccuuid,
        receiverAlias: 'SYSTEM_POOL',
        senderFinAddress: myWallet.finAddress,
        receiverFinAddress: 'SYSTEM',
        amount: dto.amount,
        currency: myWallet.currency,
        status: TransactionStatus.COMPLETED,
        reference: 'Wallet Withdrawal',
      }),
    );

    // 3. Update Balance
    myWallet.balance = Number(myWallet.balance) - dto.amount;
    return this.wallRepo.save(myWallet);
  }

  // ==========Wallet Transfer==============
  async transferWallet(dto: TransferWalletDto, participantId: string) {
    // sender wallet
    const sender = await this.wallRepo.findOne({
      where: { walletId: dto.senderWalletId, participantId },
    });
    if (!sender) throw new NotFoundException('Sender wallet not found');

    // receiver wallet by finAddress — cross-participant allowed
    const receiver = await this.wallRepo.findOne({
      where: { finAddress: dto.receiverFinAddress },
    });
    if (!receiver) throw new NotFoundException('Receiver wallet not found');

    // self transfer not possible wallet to wallet
    if (sender.walletId === receiver.walletId) {
      throw new BadRequestException('Cannot transfer to your own wallet');
    }

    // Check sender balance
    if (Number(sender.balance) < dto.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // Move money in accounts ledger
    const txId = `TRANSFER-${Date.now()}`;
    await this.accService.transfer(
      txId,
      sender.finAddress, // WALLET-{uuidA}
      receiver.finAddress, // WALLET-{uuidB}
      dto.amount,
    );

    // Log transaction
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

    // Update both wallet balances
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
}
