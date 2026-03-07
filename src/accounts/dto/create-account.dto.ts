import { IsEnum, IsNumber, IsPositive, IsString } from 'class-validator';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreateAccountDto {
  @IsString()
  finAddress: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsNumber()
  @IsPositive()
  balance: number;

  @IsString()
  participantId: string;
}
