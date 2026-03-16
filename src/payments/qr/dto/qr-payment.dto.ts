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
