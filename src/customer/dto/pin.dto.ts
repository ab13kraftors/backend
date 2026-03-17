import { IsString, Length, Matches } from 'class-validator';

export class SetPinDto {
  @IsString()
  @Length(6, 6, { message: 'PIN must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'PIN must contain only digits' })
  pin: string;
}

export class ChangePinDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  currentPin: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  newPin: string;
}

export class VerifyPinDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;
}