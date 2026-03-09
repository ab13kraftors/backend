import { Currency } from 'src/common/enums/transaction.enums';
import { IsString, IsEnum } from 'class-validator';

export class BulkUploadDto {
  @IsString()
  debtorBic: string;

  @IsString()
  debtorAccount: string;

  @IsEnum(Currency)
  currency: Currency;
}
