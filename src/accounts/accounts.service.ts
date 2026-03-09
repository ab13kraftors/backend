import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { Repository } from 'typeorm';
import { LedgerEntry } from './entities/ledger.entity';
import { DataSource } from 'typeorm';
import { CrDbType, Currency } from 'src/common/enums/transaction.enums';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    // Inject Account repository
    @InjectRepository(Account) private accRepo: Repository<Account>,
    // Inject Ledger repository
    @InjectRepository(LedgerEntry) private ledRepo: Repository<LedgerEntry>,
    // Inject TypeORM datasource for transactions
    private dataSource: DataSource,
  ) {}

  // ================== ensureSystemAccount ==================
  // Ensures a system internal account exists for platform operations
  async ensureSystemAccount() {
    const existing = await this.accRepo.findOne({
      where: { finAddress: 'SYSTEM_INTERNAL' },
    });

    // Create system account if it does not exist
    if (!existing) {
      await this.accRepo.save(
        this.accRepo.create({
          finAddress: 'SYSTEM_INTERNAL',
          participantId: 'SYSTEM',
          balance: 999_999_999, // large float pool for testing
          currency: Currency.SLE,
        }),
      );
    }
  }

  // ================== createAccount ==================
  // Creates a new account for a participant
  async create(participantId: string, dto: CreateAccountDto) {
    const existing = await this.accRepo.findOne({
      where: { finAddress: dto.finAddress },
    });

    // Prevent duplicate account creation
    if (existing) throw new BadRequestException('Account already exists');

    const newAcc = this.accRepo.create({
      ...dto,
      participantId,
    });

    // Save account to database
    return this.accRepo.save(newAcc);
  }

  // ================== getByFinAddress ==================
  // Fetch account details using FIN address
  async getByFinAddress(finAddress: string) {
    const account = await this.accRepo.findOne({
      where: { finAddress },
    });

    // Throw error if account not found
    if (!account) throw new NotFoundException('Account does not exists');

    return account;
  }

  // ================== transfer ==================
  // Transfers money between two accounts with ledger recording
  async transfer(
    txId: string,
    senderFin: string,
    receiverFin: string,
    amount: number,
  ) {
    // Execute transfer in DB transaction for atomicity
    return this.dataSource.transaction(async (manager) => {
      const sender = await manager.findOne(Account, {
        where: { finAddress: senderFin },
      });
      const receiver = await manager.findOne(Account, {
        where: { finAddress: receiverFin },
      });

      // Validate sender and receiver accounts
      if (!sender)
        throw new NotFoundException('Account does not exists of sender');
      if (!receiver)
        throw new NotFoundException('Account does not exists of receiver');

      // Ensure sender has sufficient balance
      if (Number(sender.balance) < amount)
        throw new BadRequestException(
          `Insufficient balance. Available balance is ${sender.balance}`,
        );

      // Debit sender and credit receiver
      sender.balance = Number(sender.balance) - amount;
      receiver.balance = Number(receiver.balance) + amount;

      // Persist updated balances
      await manager.save(sender);
      await manager.save(receiver);

      // Record debit entry in ledger
      await manager.save(LedgerEntry, {
        accountId: sender.accountId,
        txId,
        type: CrDbType.DEBIT,
        amount,
      });

      // Record credit entry in ledger
      await manager.save(LedgerEntry, {
        accountId: receiver.accountId,
        txId,
        type: CrDbType.CREDIT,
        amount,
      });

      // Return updated balances
      return {
        senderBalance: sender.balance,
        receiverBalance: receiver.balance,
      };
    });
  }

  // ================== getAll ==================
  // Returns all accounts belonging to a participant
  async getAll(participantId: string) {
    return this.accRepo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  // ================== deleteAccount ==================
  // Deletes an account (allowed for bank/owner only)
  async delete(accountId: string, participantId: string) {
    const account = await this.accRepo.findOne({
      where: { accountId, participantId },
    });

    // Validate account existence
    if (!account) throw new NotFoundException('Account not found');

    // Remove account from database
    await this.accRepo.remove(account);

    return { message: `Account ${accountId} deleted successfully` };
  }
}
