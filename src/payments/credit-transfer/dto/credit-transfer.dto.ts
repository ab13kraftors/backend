import {
  IsEnum,
  IsNumber,
  IsString,
  IsPositive,
  IsNotEmpty,
  MinLength,
} from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreditTransferDto {
  @IsString()
  @IsNotEmpty()
  senderAlias: string;

  @IsEnum(AliasType)
  senderAliasType: AliasType;

  @IsString()
  @IsNotEmpty()
  receiverAlias: string;

  @IsEnum(AliasType)
  receiverAliasType: AliasType;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reference: string;
}
