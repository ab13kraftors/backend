import { IsNumber, IsPositive, IsString } from 'class-validator';

export class WithdrawWalletDto {
  @IsString()
  walletId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}
