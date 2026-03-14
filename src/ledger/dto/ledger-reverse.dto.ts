import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReverseLedgerDto {
  @IsString()
  @IsNotEmpty()
  originalTxId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
