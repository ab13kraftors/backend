import { IsEnum, IsNotEmpty, Length } from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';

export class CreateAliasDto {
  @IsEnum(AliasType)
  type: AliasType;

  @IsNotEmpty()
  @Length(3, 100)
  value: string;
}