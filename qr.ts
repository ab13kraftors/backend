
/////////////////////////
// FILE: src/payments/qr/qr.controller.ts
/////////////////////////
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrPaymentDto } from './dto/qr-payment.dto';
import { QrGenerateDto } from './dto/qr-generate.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('/api/fp/payments')
export class QrController {
  constructor(private readonly qrs: QrService) {}

  @Post('qr/generate')
  generateQR(@Body() dto: QrGenerateDto) {
    return this.qrs.createQR(dto);
  }

  @Post('qr/decode')
  decodeQR(@Body('qrPayload') qrPayload: string) {
    return this.qrs.decode(qrPayload);
  }

  @Post('qr')
  initiate(@Body() dto: QrPaymentDto, @Participant() participantId: string) {
    return this.qrs.process(participantId, dto);
  }
}

/////////////////////////
// FILE: src/payments/qr/qr.module.ts
/////////////////////////
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transaction/entities/transaction.entity';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { CasModule } from 'src/cas/cas.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { CustomerModule } from 'src/customer/customer.module';
import { PaymentsService } from '../payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    CasModule,
    LedgerModule,
    AccountsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => CustomerModule),
  ],
  controllers: [QrController],
  providers: [QrService, PaymentsService],
  exports: [QrService],
})
export class QrModule {}

/////////////////////////
// FILE: src/payments/qr/qr.service.ts
/////////////////////////
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import * as QRCode from 'qrcode';

import { Transaction } from '../transaction/entities/transaction.entity';
import { QrPaymentDto } from './dto/qr-payment.dto';
import { QrGenerateDto } from './dto/qr-generate.dto';

import { CasService } from 'src/cas/cas.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';
import { CustomerService } from 'src/customer/customer.service';
import { PaymentsService } from '../payments.service';

import { AliasType } from 'src/common/enums/alias.enums';
import {
  Currency,
  TransactionStatus,
  TransactionType,
} from 'src/common/enums/transaction.enums';

type ParsedQrPayload = {
  aliasType: AliasType;
  aliasValue: string;
  amount?: string;
  currency?: Currency;
  merchantName?: string;
  reference?: string;
};

type ResolvedQrSource = {
  sourceType: 'ACCOUNT' | 'WALLET';
  customerId?: string;
  senderAlias: string;
  senderFinAddress: string;
  sourceAccountId?: string | null;
  sourceWalletId?: string | null;
};

@Injectable()
export class QrService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    private readonly ledgerService: LedgerService,
    private readonly cas: CasService,
    private readonly accountsService: AccountsService,

    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,

    @Inject(forwardRef(() => CustomerService))
    private readonly customerService: CustomerService,

    private readonly paymentsService: PaymentsService,
    private readonly dataSource: DataSource,
  ) {
    Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
  }

  async decode(qrPayload: string) {
    const parsedData = this.parseQrString(qrPayload);

    if (!parsedData.aliasType || !parsedData.aliasValue) {
      throw new BadRequestException('QR missing alias information');
    }

    const merchant = await this.cas.resolveAlias(
      parsedData.aliasType,
      parsedData.aliasValue,
    );

    return {
      merchantName: parsedData.merchantName || parsedData.aliasValue,
      merchantAccount: merchant.finAddress,
      amount: parsedData.amount || null,
      currency: parsedData.currency || Currency.SLE,
      reference: parsedData.reference || null,
      qrPayload,
    };
  }

  async process(participantId: string, dto: QrPaymentDto) {
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const parsedData = this.parseQrString(dto.qrPayload);

      const merchant = await this.cas.resolveAlias(
        parsedData.aliasType,
        parsedData.aliasValue,
      );

      const source = await this.resolveSource(participantId, dto, manager);

      if (source.senderFinAddress === merchant.finAddress) {
        throw new BadRequestException('Sender and receiver cannot be same');
      }

      const finalAmount = dto.amount || parsedData.amount;
      if (!finalAmount) {
        throw new BadRequestException('Payment amount required');
      }

      const amount = new Decimal(finalAmount);
      if (amount.isNaN() || amount.lte(0)) {
        throw new BadRequestException('Invalid payment amount');
      }

      const currency = dto.currency || parsedData.currency || Currency.SLE;
      if (currency !== Currency.SLE) {
        throw new BadRequestException('Only SLE currency is supported');
      }

      if (dto.pin && source.sourceType === 'WALLET') {
        const wallet = await this.walletService.getWallet(
          source.sourceWalletId!,
          participantId,
        );

        if (!wallet) {
          throw new NotFoundException('Wallet not found');
        }

        await this.walletService.verifyPinWithLock(
          wallet,
          participantId,
          dto.pin,
        );
      }

      if (dto.pin && source.sourceType === 'ACCOUNT' && source.customerId) {
        await this.customerService.verifyPin(
          source.customerId,
          participantId,
          dto.pin,
        );
      }

      await this.accountsService.assertFinAddressActive(
        source.senderFinAddress,
        manager,
      );
      await this.accountsService.assertFinAddressActive(
        merchant.finAddress,
        manager,
      );

      const tx = manager.getRepository(Transaction).create({
        participantId,
        channel: TransactionType.QR_PAYMENT,
        senderAlias: source.senderAlias,
        senderFinAddress: source.senderFinAddress,
        receiverFinAddress: merchant.finAddress,
        receiverAlias: parsedData.aliasValue,
        amount: Number(amount.toFixed(2)),
        currency,
        status: TransactionStatus.INITIATED,
        reference:
          dto.reference ||
          parsedData.reference ||
          `QR Payment to ${parsedData.aliasValue}`,
        externalId:
          dto.idempotencyKey || this.paymentsService.generateReference(),
      });

      const savedTx = await manager.getRepository(Transaction).save(tx);

      try {
        const transferResult = await this.ledgerService.postTransfer(
          {
            txId: savedTx.txId,
            idempotencyKey: dto.idempotencyKey,
            reference: savedTx.reference ?? `QR-${savedTx.txId}`,
            participantId,
            postedBy: 'qr-service',
            currency,
            legs: [
              {
                finAddress: savedTx.senderFinAddress,
                amount: amount.toFixed(2),
                isCredit: false,
                memo:
                  dto.narration?.trim() ||
                  `QR payment to ${savedTx.receiverAlias}`,
              },
              {
                finAddress: savedTx.receiverFinAddress,
                amount: amount.toFixed(2),
                isCredit: true,
                memo:
                  dto.narration?.trim() ||
                  `QR payment from ${savedTx.senderAlias}`,
              },
            ],
          },
          manager,
        );

        savedTx.status = TransactionStatus.COMPLETED;
        await manager.getRepository(Transaction).save(savedTx);

        const [senderBalance, receiverBalance] = await Promise.all([
          this.ledgerService.getDerivedBalance(savedTx.senderFinAddress),
          this.ledgerService.getDerivedBalance(savedTx.receiverFinAddress),
        ]);

        return {
          status: 'success',
          txId: savedTx.txId,
          journalId: transferResult.journalId,
          senderFinAddress: savedTx.senderFinAddress,
          receiverFinAddress: savedTx.receiverFinAddress,
          senderBalance,
          receiverBalance,
        };
      } catch (error) {
        savedTx.status = TransactionStatus.FAILED;
        await manager.getRepository(Transaction).save(savedTx);
        throw error;
      }
    });
  }

  async createQR(dto: QrGenerateDto) {
    if (dto.currency && dto.currency !== Currency.SLE) {
      throw new BadRequestException('Only SLE currency is supported');
    }

    if (dto.amount) {
      const amount = new Decimal(dto.amount);
      if (amount.isNaN() || amount.lte(0)) {
        throw new BadRequestException('Invalid QR amount');
      }
    }

    const payload = JSON.stringify({
      aliasType: dto.aliasType,
      aliasValue: dto.aliasValue,
      amount: dto.amount,
      currency: dto.currency || Currency.SLE,
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

  private async resolveSource(
    participantId: string,
    dto: QrPaymentDto,
    manager: EntityManager,
  ): Promise<ResolvedQrSource> {
    if (dto.sourceType === 'WALLET') {
      if (!dto.sourceWalletId) {
        throw new BadRequestException(
          'sourceWalletId is required for wallet source',
        );
      }

      const wallet = await this.walletService.getWallet(
        dto.sourceWalletId,
        participantId,
      );

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      return {
        sourceType: 'WALLET',
        customerId: wallet.customerId,
        senderAlias: dto.senderAlias || wallet.customerId,
        senderFinAddress: wallet.finAddress,
        sourceWalletId: wallet.walletId,
        sourceAccountId: wallet.accountId,
      };
    }

    if (dto.sourceFinAddress) {
      await this.accountsService.assertFinAddressActive(
        dto.sourceFinAddress,
        manager,
      );

      return {
        sourceType: 'ACCOUNT',
        customerId: dto.customerId,
        senderAlias: dto.senderAlias || dto.customerId || dto.sourceFinAddress,
        senderFinAddress: dto.sourceFinAddress,
        sourceAccountId: dto.sourceAccountId ?? null,
      };
    }

    throw new BadRequestException(
      'Provide sourceFinAddress for ACCOUNT source or sourceWalletId for WALLET source',
    );
  }

  private parseQrString(payload: string): ParsedQrPayload {
    try {
      const parsed: unknown = JSON.parse(payload);

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'aliasType' in parsed &&
        'aliasValue' in parsed
      ) {
        return parsed as ParsedQrPayload;
      }

      throw new BadRequestException('Invalid QR payload');
    } catch {
      throw new BadRequestException('Invalid QR Payload format');
    }
  }
}

/////////////////////////
// FILE: src/payments/qr/dto/qr-generate.dto.ts
/////////////////////////
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class QrGenerateDto {
  @IsEnum(AliasType)
  aliasType: AliasType;

  @IsString()
  @IsNotEmpty()
  aliasValue: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  merchantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  reference?: string;
}

/////////////////////////
// FILE: src/payments/qr/dto/qr-payment.dto.ts
/////////////////////////
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Currency } from 'src/common/enums/transaction.enums';

export class QrPaymentDto {
  @IsString()
  @IsNotEmpty()
  qrPayload: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsIn(['ACCOUNT', 'WALLET'])
  sourceType: 'ACCOUNT' | 'WALLET';

  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @IsOptional()
  @IsString()
  sourceWalletId?: string;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsOptional()
  @IsString()
  senderAlias?: string;

  @IsOptional()
  @IsString()
  debtorName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  reference?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  @Length(4, 6)
  @Matches(/^\d{4,6}$/)
  pin?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
