import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w-]{8,64}$/, {
    message: 'finAddress must be 8-64 alphanumeric characters or hyphens',
  })
  finAddress: string;

  @IsEnum(Currency)
  currency: Currency = Currency.SLE; // default to SLE
}