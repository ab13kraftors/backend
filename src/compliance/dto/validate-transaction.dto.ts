import { IsEnum, IsString, Matches } from 'class-validator';



export class ValidateTransactionDto {
  @IsString()
  customerId: string;

  @IsEnum(ComplianceTxnType)
  type: ComplianceTxnType;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount: string;

  @IsString()
  currency: string;
}