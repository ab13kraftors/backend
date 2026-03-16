import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWalletDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsString()
  finAddress?: string;
}
