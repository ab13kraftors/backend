import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
} from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class RtpInitiateDto {
  @IsString()
  @IsNotEmpty()
  requesterAlias: string;

  @IsString()
  @IsNotEmpty()
  payerAlias: string;

  @IsEnum(AliasType)
  payerAliasType: AliasType = AliasType.MSISDN;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(Currency)
  currency: Currency = Currency.SLE;

  @IsOptional()
  @IsString()
  message?: string;
}
