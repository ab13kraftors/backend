import { AliasStatus, AliasType } from 'src/common/enums/alias.enums';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
export class CreateAliasDto {
  @IsEnum(AliasType)
  type: AliasType;

  @IsNotEmpty()
  value: string;

  @IsOptional()
  @IsEnum(AliasStatus)
  status?: AliasStatus;

  @IsOptional()
  @IsBoolean()
  isOwner?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  expireDate?: string;
}
