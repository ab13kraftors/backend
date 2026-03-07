import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Repository } from 'typeorm';
import { CasService } from 'src/cas/cas.service';
import { PaymentsService } from '../payments.service';
import { CreditTransferDto } from './dto/credit-transfer.dto';
import {
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import { AccountsService } from 'src/accounts/accounts.service';

@Injectable()
export class CreditTransferService {
  constructor(
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    private casService: CasService,
    private accService: AccountsService,
    private paymentsService: PaymentsService,
  ) {}

  async initiate(participantId: string, dto: CreditTransferDto) {
    // ReceiverAlias CAS Resolve it
    const receiver = await this.casService.resolveAlias(
      dto.receiverAliasType,
      dto.receiverAlias,
    );

    // SenderAlias CAS Resolve it
    const sender = await this.casService.resolveAlias(
      dto.receiverAliasType,
      dto.senderAlias,
    );

    // Create Transaction
    const tx = this.txRepo.create({
      participantId,
      channel: TransactionType.CREDIT_TRANSFER,
      senderAlias: dto.senderAlias,
      receiverAlias: dto.receiverAlias,
      senderFinAddress: sender.finAddress,
      receiverFinAddress: receiver.finAddress,
      amount: dto.amount,
      currency: dto.currency,
      reference: dto.reference,
      status: TransactionStatus.INITIATED,
    });

    const savedTx = await this.txRepo.save(tx);

    try {
      // Ledger Transfer
      await this.accService.transfer(
        savedTx.txId,
        savedTx.senderFinAddress,
        savedTx.receiverFinAddress,
        Number(savedTx.amount),
      );

      // Update status on success
      savedTx.status = TransactionStatus.COMPLETED;

      return await this.txRepo.save(savedTx);
    } catch (error) {
      // Handle failed transfer ( Insufficient Balance)
      savedTx.status = TransactionStatus.FAILED;
      await this.txRepo.save(savedTx);
      throw error;
    }
  }
}
