import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ApplyLoanDto {
  @IsNumberString()
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;
}
