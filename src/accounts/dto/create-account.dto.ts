import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AccountType } from '../enums/account.enum';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreateAccountDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  walletId?: string;

  @IsString()
  participantId: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsEnum(AccountType)
  type: AccountType;

  @IsString()
  finAddress?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
