import { IsString, IsNumberString } from 'class-validator';

export class CheckLimitDto {
  @IsString()
  customerId: string;

  @IsNumberString()
  amount: string;

  @IsString()
  direction: 'DEBIT' | 'CREDIT'; // send or receive
}
