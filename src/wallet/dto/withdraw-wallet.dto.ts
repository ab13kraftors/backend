import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class WithdrawWalletDto {
  @IsString()
  walletId: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;

  @IsOptional()
  @IsString()
  destinationFinAddress?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
