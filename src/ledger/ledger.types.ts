export interface LedgerTransferInput {
  idempotencyKey?: string;
  txId: string;
  reference: string;
  participantId: string;
  postedBy: string;
  legs: Array<{
    finAddress: string; // identifies account
    amount: string; // positive number – direction determined by isCredit
    isCredit: boolean; // true = money leaving this account (credit)
    memo?: string;
  }>;
}

export interface LedgerTransferResult {
  journalId: string;
  txId: string;
  status: 'created' | 'already_processed';
}
