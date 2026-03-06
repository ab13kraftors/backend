import { Currency } from 'src/common/enums/transaction.enums';
import { IsString, IsEnum } from 'class-validator';

export class BulkUploadDto {
  @IsString()
  debtorBic: string; // FIX: renamed bic → debtorBic to match entity + Switch API

  @IsString()
  debtorAccount: string; // FIX: ADDED — required by the Switch bulk endpoint

  @IsEnum(Currency)
  currency: Currency;
}
