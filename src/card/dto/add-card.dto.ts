// src/card/dto/add-card.dto.ts
import {
  IsString,
  IsEnum,
  Min,
  Max,
  Length,
  IsNumberString,
} from 'class-validator';
import { CardBrand } from 'src/common/enums/card.enums';

export class AddCardDto {
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

  @Min(1)
  @Max(12)
  expMonth: number;

  @Min(new Date().getFullYear())
  expYear: number;
}
