import { IsString, Length, Matches } from 'class-validator';

export class FundWalletDto {
  @IsString()
  walletId: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;
}
