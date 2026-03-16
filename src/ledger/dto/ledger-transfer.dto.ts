import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from 'src/common/enums/transaction.enums';

export class LedgerTransferLegDto {
  @IsString()
  @IsNotEmpty()
  finAddress: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsBoolean()
  isCredit: boolean;

  @IsOptional()
  @IsString()
  memo?: string;
}

export class LedgerTransferDto {
  @IsString()
  @IsNotEmpty()
  txId: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  @IsNotEmpty()
  participantId: string;

  @IsOptional()
  @IsString()
  postedBy?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LedgerTransferLegDto)
  legs: LedgerTransferLegDto[];
}
