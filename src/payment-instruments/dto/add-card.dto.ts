import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CardBrand } from 'src/common/enums/card.enums';

export class AddCardDto {
  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsString()
  token: string;

  @IsNumberString()
  @Length(6, 6)
  bin: string;

  @IsNumberString()
  @Length(4, 4)
  last4: string;

  @IsEnum(CardBrand)
  brand: CardBrand;

  @IsNumber()
  @Min(1)
  @Max(12)
  expMonth: number;

  @IsNumber()
  @Min(new Date().getFullYear())
  expYear: number;

  @IsOptional()
  @IsString()
  holderName?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
