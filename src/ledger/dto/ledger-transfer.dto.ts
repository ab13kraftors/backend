import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from 'src/common/enums/transaction.enums';

export class TransferLegDto {
  @IsString()
  @IsNotEmpty()
  finAddress: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount: string;

  @IsEnum(['DEBIT', 'CREDIT'], { message: 'isCredit must be true (DEBIT) or false (CREDIT)' })
  isCredit: boolean;  // true = money leaving (DEBIT), false = money arriving (CREDIT)

  @IsString()
  @IsOptional()
  memo?: string;
}
