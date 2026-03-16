import { AccountType } from '../enums/account.enum';
import { Currency } from 'src/common/enums/transaction.enums';

export class AccountBalanceResponseDto {
  accountId: string; // UUID of the account
  accountNumber: string; // Unique account number
  type: AccountType; // Enum instead of plain string
  currency: Currency; // Enum instead of plain string
  availableBalance: number; // Numeric type for balance
}
