import { IsString } from 'class-validator';

export class WithdrawDto {
  @IsString()
  walletId: string;

  @IsString()
  amount: string;

  @IsString()
  pin: string;

  @IsString()
  destination: string;
}
