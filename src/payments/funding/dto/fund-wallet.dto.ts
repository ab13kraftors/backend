import { IsEnum, IsNumber, IsPositive, IsString } from 'class-validator';
import { FundMethod } from 'src/common/enums/bulk.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class FundingWalletDto {
  @IsString()
  walletId: string;

  @IsEnum(FundMethod)
  method: FundMethod;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(Currency)
  currency: Currency;
}
