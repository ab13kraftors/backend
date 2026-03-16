import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Currency } from 'src/common/enums/transaction.enums';

export class CreateSystemAccountDto {
  @IsString()
  @Length(2, 100)
  participantId: string;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsString()
  @Length(3, 255)
  @Matches(/^[a-zA-Z0-9._@-]+$/, {
    message: 'finAddress contains invalid characters',
  })
  finAddress?: string;
}
