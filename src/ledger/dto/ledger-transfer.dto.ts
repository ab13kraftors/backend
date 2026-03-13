import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class TransferLegDto {
  @IsString()
  @IsNotEmpty()
  finAddress: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount: string;

  @IsBoolean({
    message:
      'isCredit must be true (CREDIT, arriving) or false (DEBIT, leaving)',
  })
  isCredit: boolean;

  @IsString()
  @IsOptional()
  memo?: string;
}
