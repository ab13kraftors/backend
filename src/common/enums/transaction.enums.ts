export enum TransactionStatus {
  INITIATED = 'INITIATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED', // Use COMPLETED or SUCCESS consistently
  FAILED = 'FAILED',
}

export enum TransactionType {
  CREDIT_TRANSFER = 'CREDIT_TRANSFER',
  QR_PAYMENT = 'QR_PAYMENT',
  RTP_PAYMENT = 'RTP_PAYMENT',
  BULK_PAYMENT = 'BULK_PAYMENT',
}

export enum Currency {
  SLE = 'SLE', // Sierra Leone Leone
  USD = 'USD',
  EUR = 'EUR',
  INR = 'INR',
}
