import { Injectable } from '@nestjs/common';
import { CasService } from 'src/cas/cas.service';
import { VerifyAccountDto } from './dto/verify-account.dto';

@Injectable()
export class VerifyService {
  constructor(
    // Inject CAS service for alias resolution
    private readonly cas: CasService,
  ) {}

  // ================== verifyAccount ==================
  // Verifies account by resolving alias via CAS
  async verifyAccount(dto: VerifyAccountDto) {
    // Resolve alias to financial address
    const result = await this.cas.resolveAlias(dto.aliasType, dto.aliasValue);

    return {
      verified: true,
      finAddress: result.finAddress,
      aliasType: dto.aliasType,
      aliasValue: dto.aliasValue,
      message: 'Account verified successfully',
    };
  }
}
