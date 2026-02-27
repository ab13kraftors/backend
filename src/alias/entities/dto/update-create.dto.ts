import { IsEnum, IsOptional } from 'class-validator';
import { AliasStatus, AliasType } from 'src/common/enums/alias.enums';

export class UpdateAliasDto {
  @IsOptional()
  @IsEnum(AliasType)
  type?: AliasType;

  @IsOptional()
  value?: string;

  @IsOptional()
  @IsEnum(AliasStatus)
  status?: AliasStatus;
}
