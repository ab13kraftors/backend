import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

// Hard KYC is submitted as multipart/form-data (files + fields)
// Files are handled by Multer — fields come in as body
export class HardKycDto {
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}
