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
    @InjectRepository(Account) private accRepo: Repository<Account>,
    @InjectRepository(LedgerEntry) private ledRepo: Repository<LedgerEntry>,
    private dataSource: DataSource,
  ) {}

  async ensureSystemAccount() {
    const existing = await this.accRepo.findOne({
      where: { finAddress: 'SYSTEM_INTERNAL' },
    });
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

  async create(participantId: string, dto: CreateAccountDto) {
    const existing = await this.accRepo.findOne({
      where: { finAddress: dto.finAddress },
    });

    if (existing) throw new BadRequestException('Account already exists');

    const newAcc = this.accRepo.create({
      ...dto,
      participantId,
    });

    return this.accRepo.save(newAcc);
  }

  async getByFinAddress(finAddress: string) {
    const account = await this.accRepo.findOne({
      where: { finAddress },
    });

    if (!account) throw new NotFoundException('Account does not exists');

    return account;
  }

  async transfer(
    txId: string,
    senderFin: string,
    receiverFin: string,
    amount: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const sender = await manager.findOne(Account, {
        where: { finAddress: senderFin },
      });
      const receiver = await manager.findOne(Account, {
        where: { finAddress: receiverFin },
      });

      if (!sender)
        throw new NotFoundException('Account does not exists of sender');
      if (!receiver)
        throw new NotFoundException('Account does not exists of receiver');

      if (Number(sender.balance) < amount)
        throw new BadRequestException(
          `Insufficient balance. Available balance is ${sender.balance}`,
        );

      sender.balance = Number(sender.balance) - amount;
      receiver.balance = Number(receiver.balance) + amount;

      await manager.save(sender);
      await manager.save(receiver);

      await manager.save(LedgerEntry, {
        accountId: sender.accountId,
        txId,
        type: CrDbType.DEBIT,
        amount,
      });
      await manager.save(LedgerEntry, {
        accountId: receiver.accountId,
        txId,
        type: CrDbType.CREDIT,
        amount,
      });

      return {
        senderBalance: sender.balance,
        receiverBalance: receiver.balance,
      };
    });
  }

  async getAll(participantId: string) {
    return this.accRepo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
    });
  }

  async delete(accountId: string) {
    const account = await this.accRepo.findOne({ where: { accountId } });

    if (!account) throw new NotFoundException('Account not found');

    await this.accRepo.remove(account);
    return { message: `Account ${accountId} deleted successfully` };
  }
}
