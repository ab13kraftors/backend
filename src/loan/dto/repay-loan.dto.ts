import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class RepayLoanDto {
  @IsNumberString()
  amount: string;

  /** Client-supplied idempotency key — prevents double-processing on retries */
  @IsOptional()
  @IsString()
  @IsUUID()
  idempotencyKey?: string;
}
