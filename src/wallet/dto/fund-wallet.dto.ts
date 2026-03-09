import {
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class FundWalletDto {
  @IsString()
  walletId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;
}
