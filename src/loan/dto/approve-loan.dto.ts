import {
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ApproveLoanDto {
  /** Admin may override the requested amount at approval time */
  @IsNumberString()
  approvedAmount: string;

  /** ISO 8601 date string e.g. "2025-12-31" */
  @IsDateString()
  dueDate: string;
}

export class RejectLoanDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
