import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KycRejectionReason } from 'src/common/enums/kyc.enums';

export class ApproveKycDto {
  // no body needed — action is implied by endpoint
}

export class RejectKycDto {
  @IsEnum(KycRejectionReason)
  reason: KycRejectionReason;

  @IsString()
  @IsOptional()
  note?: string;
}
