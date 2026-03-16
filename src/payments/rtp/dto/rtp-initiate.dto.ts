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

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsEnum(Currency)
  @IsOptional()
  currency: Currency = Currency.SLE;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  reference?: string;
}
