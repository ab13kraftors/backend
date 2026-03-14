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

  @IsEnum(AliasType)
  requesterAliasType: AliasType;

  @IsString()
  @IsNotEmpty()
  payerAlias: string;

  @IsEnum(AliasType)
  @IsOptional()
  payerAliasType: AliasType = AliasType.MSISDN;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(Currency)
  @IsOptional()
  currency: Currency = Currency.SLE;

  @IsOptional()
  @IsString()
  message?: string;
}
