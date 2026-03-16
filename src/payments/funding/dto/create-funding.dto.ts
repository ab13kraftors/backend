import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { FundMethod } from 'src/common/enums/bulk.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreateFundingDto {
  @IsString()
  walletId: string;

  @IsEnum(FundMethod)
  method: FundMethod;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
