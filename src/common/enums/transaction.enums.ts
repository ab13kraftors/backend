export enum TransactionStatus {
  INITIATED = 'INITIATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum TransactionType {
  CREDIT_TRANSFER = 'CREDIT_TRANSFER',
  QR_PAYMENT = 'QR_PAYMENT',
  RTP_PAYMENT = 'RTP_PAYMENT',
  BULK_PAYMENT = 'BULK_PAYMENT',
  WALLET_FUNDING = 'WALLET_FUNDING',
  WALLET_WITHDRAWAL = 'WALLET_WITHDRAWAL',
  CARD_LOAD = 'CARD_LOAD',
}

export enum Currency {
  SLE = 'SLE', // Sierra Leone Leone
  USD = 'USD',
  EUR = 'EUR',
  INR = 'INR',
}

export enum CrDbType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum CardTransaction {
  INITIATED = 'INITIATED',
  GATEWAY_SUCCESS = 'GATEWAY_SUCCESS',
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
}
