import { IsNumber, IsPositive, IsString } from 'class-validator';

export class TransferWalletDto {
  @IsString()
  senderWalletId: string; // sender identifies by their own walletId

  @IsString()
  receiverFinAddress: string; // receiver identified by finAddress (WALLET-{uuid})

  @IsNumber()
  @IsPositive()
  amount: number;
}
