import { IsEnum, IsNotEmpty } from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';

export class ResolveAliasDto {
  @IsEnum(AliasType)
  aliasType: AliasType;

  @IsNotEmpty()
  aliasValue: string;
}