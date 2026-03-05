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

  @IsString()
  @IsNotEmpty()
  receiverAlias: string;

  @IsEnum(AliasType)
  receiverAliasType: AliasType;

  @IsNumber()
  @IsPositive() // Prevents negative amounts
  amount: number;

  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  @IsNotEmpty()
  @MinLength(3) // Ensures reference isn't just a single character
  reference: string;
}
