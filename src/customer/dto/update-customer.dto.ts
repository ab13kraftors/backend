import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  ValidateIf,
  IsEmail,
  IsString,
} from 'class-validator';
import {
  CustomerType,
  LinkageType,
  CustomerStatus,
  Gender,
  DocumentType,
} from 'src/common/enums/customer.enums';

export class UpdateCustomerDto {
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsEnum(LinkageType)
  linkageType?: LinkageType;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsDateString()
  documentValidityDate?: string;

  @IsOptional()
  @IsString()
  msisdn?: string;

  @IsOptional()
  @IsBoolean()
  msisdnIsOwned?: boolean;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  firstName?: string;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsString()
  lastName?: string;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsEmail()
  firstEmail?: string;

  @IsOptional()
  @IsEmail()
  secondEmail?: string;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.COMPANY)
  @IsOptional()
  @IsString()
  companyName?: string;
}