import { Currency } from 'src/common/enums/transaction.enums';

export interface LedgerTransferLegInput {
  finAddress: string;
  amount: string;
  isCredit: boolean;
  memo?: string;
}

export interface LedgerTransferInput {
  txId: string;
  reference?: string;
  participantId: string;
  postedBy?: string;
  idempotencyKey?: string;
  currency: Currency;
  legs: LedgerTransferLegInput[];
}

export interface LedgerTransferResult {
  journalId: string;
  txId: string;
  status: 'created' | 'already_processed';
}
