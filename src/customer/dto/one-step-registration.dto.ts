import { CreateCustomerDto } from './create-customer.dto';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAliasDto } from 'src/alias/dto/create-alias.dto';
import { CreateFinAddressDto } from 'src/finaddress/dto/create-finaddress.dto';

export class OneStepRegistrationDto {
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer: CreateCustomerDto;

  @ValidateNested()
  @Type(() => CreateAliasDto)
  alias: CreateAliasDto;

  @ValidateNested()
  @Type(() => CreateFinAddressDto)
  finAddress: CreateFinAddressDto;
}
