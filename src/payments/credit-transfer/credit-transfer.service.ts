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

import { LedgerService } from 'src/ledger/ledger.service';

@Injectable()
export class CreditTransferService {
  constructor(
    // Inject Transaction repository
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,

    // Inject CAS service for alias resolution
    private casService: CasService,

    // Inject Ledger service for ledger transfers
    private ledgerService: LedgerService,

    // Inject Payments service (orchestration layer)
    private paymentsService: PaymentsService,
  ) {}

  // ================== initiate ==================
  // Initiates a credit transfer between two aliases
  async initiate(participantId: string, dto: CreditTransferDto) {
    // Resolve receiver alias to financial address
    const receiver = await this.casService.resolveAlias(
      dto.receiverAliasType,
      dto.receiverAlias,
    );

    // Resolve sender alias to financial address
    const sender = await this.casService.resolveAlias(
      dto.senderAliasType,
      dto.senderAlias,
    );

    // Create transaction record
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
      await this.ledgerService.postTransfer({
        txId: savedTx.txId,
        reference: savedTx.reference ?? `CT-${savedTx.txId}`,
        participantId,
        postedBy: 'system',
        legs: [
          {
            finAddress: savedTx.senderFinAddress,
            amount: String(savedTx.amount),
            isCredit: false, // DEBIT — money leaving sender
            memo: `Credit transfer to ${savedTx.receiverAlias}`,
          },
          {
            finAddress: savedTx.receiverFinAddress,
            amount: String(savedTx.amount),
            isCredit: true, // CREDIT — money arriving at receiver
            memo: `Credit transfer from ${savedTx.senderAlias}`,
          },
        ],
      });

      // Mark transaction completed
      savedTx.status = TransactionStatus.COMPLETED;

      return await this.txRepo.save(savedTx);
    } catch (error) {
      // Handle failed transfer (e.g., insufficient balance)
      savedTx.status = TransactionStatus.FAILED;
      await this.txRepo.save(savedTx);

      throw error;
    }
  }
}
