import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from 'src/common/enums/transaction.enums';
import { TransferLegDto } from './ledger-transfer.dto';

export class PostLedgerDto {
  @IsString()
  @IsNotEmpty()
  txId: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsString()
  @IsOptional()
  postedBy?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferLegDto)
  legs: TransferLegDto[];

  // Optional: enforce single currency in the future
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}
