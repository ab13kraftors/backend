import {
  IsEnum,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsBoolean,
  ValidateIf,
  IsEmail,
} from 'class-validator';
import {
  CustomerType,
  LinkageType,
  Gender,
} from 'src/common/enums/customer.enums';

export class CreateCustomerDto {
  // COMMON (ALL CUSTOMERS)

  @IsEnum(CustomerType)
  type: CustomerType;

  @IsNotEmpty()
  externalId: string;

  @IsEnum(LinkageType)
  linkageType: LinkageType;

  @IsNotEmpty()
  documentType: string;

  @IsNotEmpty()
  documentId: string;

  @IsDateString()
  documentValidityDate: string;

  @IsNotEmpty()
  msisdn: string;

  @IsOptional()
  @IsBoolean()
  msisdnIsOwned?: boolean;

  // INDIVIDUAL ONLY

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsNotEmpty()
  firstName?: string;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
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

  // COMPANY ONLY

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.COMPANY)
  @IsNotEmpty()
  companyName?: string;
}
