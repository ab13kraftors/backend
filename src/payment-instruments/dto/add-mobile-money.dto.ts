import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { MobileMoneyProvider } from '../enums/mobile-money.enum';

export class AddMobileMoneyDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsEnum(MobileMoneyProvider)
  provider: MobileMoneyProvider;

  @IsString()
  msisdn: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
