import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsEnum,
} from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class QrPaymentDto {
  @IsString()
  @IsNotEmpty()
  qrPayload: string; // The decoded or raw string from the scan

  @IsOptional() // Amount is optional here if it was already in the QR payload
  @IsNumber()
  @IsPositive()
  amount?: number;

  @IsEnum(AliasType)
  @IsOptional()
  senderAlias: AliasType = AliasType.MSISDN;

  @IsString()
  @IsNotEmpty()
  debtorAccount: string; // The sender's bank account

  @IsString()
  @IsNotEmpty()
  debtorName: string;

  @IsEnum(Currency)
  currency: Currency;
}
