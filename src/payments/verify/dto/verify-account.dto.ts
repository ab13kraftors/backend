import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';

export class VerifyAccountDto {
  @IsEnum(AliasType)
  aliasType: AliasType;

  @IsString()
  @IsNotEmpty()
  aliasValue: string;

  @IsOptional()
  @IsString()
  participantId?: string;
}
