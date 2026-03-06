import {
  IsArray,
  IsString,
  IsNumber,
  IsPositive,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Currency } from 'src/common/enums/transaction.enums';

export class BulkPaymentItem {
  @IsString()
  senderAlias: string;

  @IsString()
  receiverAlias: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(Currency) // Validates against SLE, USD, EUR, INR
  currency: Currency;
}

export class BulkPaymentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPaymentItem)
  payments: BulkPaymentItem[];
}
