import { IsNumberString } from 'class-validator';

export class RepayLoanDto {
  @IsNumberString()
  amount: string;
}
