import {
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class TransferWalletDto {
  @IsString()
  senderWalletId: string; // sender identifies by their own walletId

  @IsString()
  receiverFinAddress: string; // receiver identified by finAddress (WALLET-{uuid})

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;
}
