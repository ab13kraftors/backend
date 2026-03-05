import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';

export class QrPaymentDto {
  @IsString()
  @IsNotEmpty()
  qrData: string; // The raw string from the QR scan (e.g., EMVCo format)

  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number; // User-entered amount if the QR is static
}

// Todo: Ensure you have a dedicated parser (like an EMVCo parser) to extract the amount, receiverAlias, and merchantName from the QR string
