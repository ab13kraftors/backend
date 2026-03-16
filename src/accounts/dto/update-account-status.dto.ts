import { IsEnum } from 'class-validator';
import { AccountStatus } from '../enums/account.enum';

export class UpdateAccountStatusDto {
  @IsEnum(AccountStatus)
  status: AccountStatus;
}
