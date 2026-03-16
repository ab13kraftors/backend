import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LedgerReverseDto {
  @IsString()
  @IsNotEmpty()
  originalTxId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  postedBy: string;

  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
