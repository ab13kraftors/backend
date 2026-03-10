import {
  IsOptional,
  IsString,
  Length,
  Matches,
  IsNotEmpty,
} from 'class-validator';

export class TransferWalletDto {
  @IsString()
  @IsNotEmpty()
  senderWalletId: string;

  @IsString()
  @IsNotEmpty()
  receiverFinAddress: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimal places',
  })
  amount: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}
