import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import {
  CustomerType,
  LinkageType,
  CustomerStatus,
  Gender,
} from 'src/common/enums/customer.enums';

export class UpdateCustomerDto {
  // REQUIRED FOR CONDITIONAL VALIDATION
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;

  // Common

  @IsOptional()
  externalId?: string;

  @IsOptional()
  @IsEnum(LinkageType)
  linkageType?: LinkageType;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  documentType?: string;

  @IsOptional()
  documentId?: string;

  @IsOptional()
  @IsDateString()
  documentValidityDate?: string;

  @IsOptional()
  msisdn?: string;

  @IsOptional()
  @IsBoolean()
  msisdnIsOwned?: boolean;

  // INDIVIDUAL

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
  firstName?: string;

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsOptional()
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
  firstEmail?: string;

  @IsOptional()
  secondEmail?: string;

  // COMPANY

  @ValidateIf((o: UpdateCustomerDto) => o.type === CustomerType.COMPANY)
  @IsOptional()
  companyName?: string;
}
