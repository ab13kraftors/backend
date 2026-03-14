import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RespondRtpDto {
  @IsUUID()
  @IsNotEmpty()
  rtpMsgId: string;

  @IsString()
  @IsNotEmpty()
  debtorAccount: string; // The account they choose to pay from

  @IsString()
  @IsNotEmpty()
  pin: string; // For the "Payment Phase" authentication
}
