import { IsEnum } from 'class-validator';
import { WalletStatus } from 'src/common/enums/banking.enums';

export class UpdateWalletStatusDto {
  @IsEnum(WalletStatus)
  status: WalletStatus;
}
