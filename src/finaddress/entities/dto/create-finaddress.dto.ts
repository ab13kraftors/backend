import { IsEnum, IsNotEmpty } from 'class-validator';
import { ServicerIdType, Type } from 'src/common/enums/finaddress.enums';

export class CreateFinAddressDto {
  @IsEnum(Type)
  type: Type;

  @IsNotEmpty()
  finAddress: string;

  @IsNotEmpty()
  @IsEnum(ServicerIdType)
  servicerIdType: ServicerIdType;

  @IsNotEmpty()
  servicerId: string;
}
