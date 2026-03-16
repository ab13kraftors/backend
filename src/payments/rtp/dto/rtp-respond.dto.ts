import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class RespondRtpDto {
  @IsUUID()
  @IsNotEmpty()
  rtpMsgId: string;

  @IsIn(['ACCOUNT', 'WALLET'])
  sourceType: 'ACCOUNT' | 'WALLET';

  @IsOptional()
  @IsString()
  sourceAccountId?: string;

  @IsOptional()
  @IsString()
  sourceWalletId?: string;

  @IsOptional()
  @IsString()
  sourceFinAddress?: string;

  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  @Matches(/^\d{4,6}$/)
  pin: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
