import { IsNumber, IsPositive, IsString } from 'class-validator';

export class FundWalletDto {
  @IsString()
  walletId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
