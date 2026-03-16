import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { Currency } from 'src/common/enums/transaction.enums';

export class BulkUploadDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  debtorBic?: string;

  @IsIn(['ACCOUNT', 'WALLET'])
  sourceType: 'ACCOUNT' | 'WALLET';

  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @IsOptional()
  @IsString()
  sourceWalletId?: string;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  @Length(4, 6)
  @Matches(/^\d{4,6}$/)
  pin: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
