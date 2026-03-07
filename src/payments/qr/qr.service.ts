import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { QrPaymentDto } from './dto/qr-payment.dto';
import { QrGenerateDto } from './dto/qr-generate.dto';
import {
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';
import * as QRCode from 'qrcode';
import { CasService } from 'src/cas/cas.service';
import { AccountsService } from 'src/accounts/accounts.service';

@Injectable()
export class QrService {
  constructor(
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,
    private accService: AccountsService,
    private cas: CasService, // Fixed name
  ) {}

  // Resolve the Merchant via CAS
  async decode(qrPayload: string) {
    const parsedData = this.parseQrString(qrPayload);

    if (!parsedData.aliasType || !parsedData.aliasValue) {
      throw new BadRequestException('QR missing alias information');
    }
    // Resolve the Merchant via CAS to get their verified bank account
    const merchant = await this.cas.resolveAlias(
      parsedData.aliasType,
      parsedData.aliasValue,
    );

    return {
      // Use merchantName directly from the scan as requested
      merchantName: parsedData.merchantName,
      merchantAccount: merchant.finAddress, // From database
      amount: parsedData.amount,
      currency: parsedData.currency || 'SLE',
      reference: parsedData.reference,
      qrPayload,
    };
  }
  async process(participantId: string, dto: QrPaymentDto) {
    // 1. Parse the payload (e.g., from JSON string)
    const parsedData = this.parseQrString(dto.qrPayload);

    // 2. Resolve the Merchant (Receiver) via CAS
    const merchant = await this.cas.resolveAlias(
      parsedData.aliasType,
      parsedData.aliasValue,
    );

    // 3. Logic for Amount & Currency Priority
    const finalAmount = dto.amount || parsedData.amount;
    if (!finalAmount || finalAmount <= 0) {
      throw new BadRequestException('Payment amount required');
    }

    const currency = parsedData.currency || dto.currency;
    if (!currency) {
      throw new BadRequestException('Currency required');
    }

    // 4. Create and Save Transaction
    const tx = this.txRepo.create({
      participantId,
      channel: TransactionType.QR_PAYMENT,
      senderAlias: dto.senderAlias,
      senderFinAddress: dto.debtorAccount,
      receiverFinAddress: merchant.finAddress,
      receiverAlias: parsedData.aliasValue,
      amount: finalAmount,
      currency,
      status: TransactionStatus.INITIATED,
      reference: parsedData.reference || `QR Payment to ${merchant.finAddress}`,
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

  async createQR(dto: QrGenerateDto) {
    // Payload usually contains Merchant Alias and optionally Amount
    const payload = JSON.stringify({
      aliasType: dto.aliasType,
      aliasValue: dto.aliasValue,
      amount: dto.amount,
      currency: dto.currency,
      merchantName: dto.merchantName,
      reference: dto.reference,
    });

    const qrImage = await QRCode.toDataURL(payload);

    return {
      payload,
      qrImage,
      generatedAt: new Date(),
    };
  }

  private parseQrString(payload: string): any {
    try {
      return JSON.parse(payload);
    } catch (e) {
      throw new BadRequestException('Invalid QR Payload format');
    }
  }
}
