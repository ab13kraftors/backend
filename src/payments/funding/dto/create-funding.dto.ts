import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { FundMethod } from 'src/common/enums/bulk.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreateFundingDto {
  @IsString()
  customerId: string; // ✅ REQUIRED

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

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
  destinationFinAddress?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
