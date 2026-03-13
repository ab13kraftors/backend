import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class ApplyLoanDto {
  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsString()
  purpose?: string;
}
