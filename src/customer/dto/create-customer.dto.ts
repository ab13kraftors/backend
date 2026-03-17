import {
  IsEnum,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsBoolean,
  ValidateIf,
  IsEmail,
  IsString,
} from 'class-validator';
import {
  CustomerType,
  LinkageType,
  Gender,
  DocumentType,
} from 'src/common/enums/customer.enums';

export class CreateCustomerDto {
  @IsEnum(CustomerType)
  type: CustomerType;

  @IsString()
  @IsNotEmpty()
  externalId: string;

  @IsEnum(LinkageType)
  linkageType: LinkageType;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsDateString()
  documentValidityDate: string;

  @IsString()
  @IsNotEmpty()
  msisdn: string;

  @IsOptional()
  @IsBoolean()
  msisdnIsOwned?: boolean;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsEnum(Gender)
  @IsNotEmpty()
  gender?: Gender;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsDateString()
  @IsNotEmpty()
  dob?: string;

  @IsOptional()
  @IsEmail()
  firstEmail?: string;

  @IsOptional()
  @IsEmail()
  secondEmail?: string;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.COMPANY)
  @IsString()
  @IsNotEmpty()
  companyName?: string;
}