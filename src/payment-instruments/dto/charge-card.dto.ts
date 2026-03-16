import { IsOptional, IsString, Matches } from 'class-validator';

export class ChargeCardDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
