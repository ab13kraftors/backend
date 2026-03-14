import { IsBoolean, IsNumberString, IsOptional } from 'class-validator';

export class LoanConfigDto {
  /** Toggle whether loan applications are accepted at all */
  @IsOptional()
  @IsBoolean()
  loansEnabled?: boolean;

  /** Platform-wide minimum loan amount */
  @IsOptional()
  @IsNumberString()
  minAmount?: string;

  /** Platform-wide maximum loan amount */
  @IsOptional()
  @IsNumberString()
  maxAmount?: string;

  /** Maximum number of loan applications a single customer may submit per day */
  @IsOptional()
  @IsNumberString()
  maxApplicationsPerDay?: string;
}
