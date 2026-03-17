import { IsNotEmpty, IsUUID } from 'class-validator';

export class SetDefaultFinAddressDto {
  @IsUUID()
  @IsNotEmpty()
  finAddressId: string;
}