import { IsString, IsNotEmpty, IsDateString, IsEnum } from 'class-validator';
import { KycDocumentType } from 'src/common/enums/kyc.enums';

export class SoftKycDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  nationality: string;

  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @IsEnum(KycDocumentType)
  idDocumentType: KycDocumentType;

  @IsDateString()
  idExpiryDate: string;
}
