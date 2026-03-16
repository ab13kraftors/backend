import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreditTransferDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @IsOptional()
  @IsString()
  sourceWalletId?: string;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsIn(['ACCOUNT', 'WALLET'])
  sourceType: 'ACCOUNT' | 'WALLET';

  @IsOptional()
  @IsString()
  senderAlias?: string;

  @IsOptional()
  @IsEnum(AliasType)
  senderAliasType?: AliasType;

  @IsOptional()
  @IsString()
  receiverAlias?: string;

  @IsOptional()
  @IsEnum(AliasType)
  receiverAliasType?: AliasType;

  @IsOptional()
  @IsString()
  receiverFinAddress?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(140)
  reference: string;

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
