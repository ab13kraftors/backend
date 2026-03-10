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
import { LedgerService } from 'src/ledger/ledger.service';

@Injectable()
export class QrService {
  constructor(
    // Inject Transaction repository
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,

    // Inject Accounts service for ledger transfer
    private ledgerService: LedgerService,

    // Inject CAS service for alias resolution
    private cas: CasService,
  ) {}

  // ================== decode ==================
  // Decodes QR payload and resolves merchant via CAS
  async decode(qrPayload: string) {
    // Parse QR payload
    const parsedData = this.parseQrString(qrPayload);

    // Validate alias information
    if (!parsedData.aliasType || !parsedData.aliasValue) {
      throw new BadRequestException('QR missing alias information');
    }

    // Resolve merchant alias to financial address
    const merchant = await this.cas.resolveAlias(
      parsedData.aliasType,
      parsedData.aliasValue,
    );

    return {
      merchantName: parsedData.merchantName,
      merchantAccount: merchant.finAddress,
      amount: parsedData.amount,
      currency: parsedData.currency || 'SLE',
      reference: parsedData.reference,
      qrPayload,
    };
  }

  // ================== process ==================
  // Processes QR payment transaction
  async process(participantId: string, dto: QrPaymentDto) {
    // Parse QR payload
    const parsedData = this.parseQrString(dto.qrPayload);

    // Resolve merchant alias
    const merchant = await this.cas.resolveAlias(
      parsedData.aliasType,
      parsedData.aliasValue,
    );

    // Determine final payment amount
    const finalAmount = dto.amount || parsedData.amount;
    if (!finalAmount || finalAmount <= 0) {
      throw new BadRequestException('Payment amount required');
    }

    // Determine currency
    const currency = parsedData.currency || dto.currency;
    if (!currency) {
      throw new BadRequestException('Currency required');
    }

    // Create transaction record
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
      // Perform ledger transfer
      await this.ledgerService.postTransfer({
        txId: savedTx.txId,
        reference: savedTx.reference ?? `QR-${savedTx.txId}`,
        participantId,
        postedBy: 'system',
        legs: [
          {
            finAddress: savedTx.senderFinAddress,
            amount: String(savedTx.amount),
            isCredit: true, // DEBIT — money leaving sender
            memo: `QR payment to ${savedTx.receiverAlias}`,
          },
          {
            finAddress: savedTx.receiverFinAddress,
            amount: String(savedTx.amount),
            isCredit: false, // CREDIT — money arriving at merchant
            memo: `QR payment from ${savedTx.senderAlias}`,
          },
        ],
      });

      // Mark transaction completed
      savedTx.status = TransactionStatus.COMPLETED;

      return await this.txRepo.save(savedTx);
    } catch (error) {
      // Mark transaction failed on error
      savedTx.status = TransactionStatus.FAILED;
      await this.txRepo.save(savedTx);
      throw error;
    }
  }

  // ================== createQR ==================
  // Generates QR code for merchant payments
  async createQR(dto: QrGenerateDto) {
    // Construct QR payload
    const payload = JSON.stringify({
      aliasType: dto.aliasType,
      aliasValue: dto.aliasValue,
      amount: dto.amount,
      currency: dto.currency,
      merchantName: dto.merchantName,
      reference: dto.reference,
    });

    // Generate QR image
    const qrImage = await QRCode.toDataURL(payload);

    return {
      payload,
      qrImage,
      generatedAt: new Date(),
    };
  }

  // ================== parseQrString ==================
  // Parses QR payload string to JSON
  private parseQrString(payload: string): any {
    try {
      return JSON.parse(payload);
    } catch (e) {
      throw new BadRequestException('Invalid QR Payload format');
    }
  }
}
