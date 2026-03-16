import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class QrGenerateDto {
  @IsEnum(AliasType)
  aliasType: AliasType;

  @IsString()
  @IsNotEmpty()
  aliasValue: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount?: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  merchantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  reference?: string;
}
