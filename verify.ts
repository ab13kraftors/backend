
/////////////////////////
// FILE: src/payments/verify/verify.controller.ts
/////////////////////////
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { VerifyService } from './verify.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { VerifyAccountDto } from './dto/verify-account.dto';

@UseGuards(JwtAuthGuard)
@Controller('/api/switch/v1/verify')
export class VerifyController {
  constructor(
    // Inject Verify service
    private readonly verifyService: VerifyService,
  ) {}

  // ================== verify ==================
  // Verifies account alias via CAS
  @Post('account')
  verify(@Body() dto: VerifyAccountDto) {
    return this.verifyService.verifyAccount(dto);
  }
}

/////////////////////////
// FILE: src/payments/verify/verify.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { VerifyController } from './verify.controller';
import { VerifyService } from './verify.service';
import { CasModule } from 'src/cas/cas.module';
import { AuthModule } from 'src/auth/auth.module';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';

@Module({
  imports: [AuthModule, CasModule],
  controllers: [VerifyController],
  providers: [VerifyService, ParticipantGuard],
})
export class VerifyModule {}

/////////////////////////
// FILE: src/payments/verify/verify.service.ts
/////////////////////////
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

/////////////////////////
// FILE: src/payments/verify/dto/verify-account.dto.ts
/////////////////////////
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { AliasType } from 'src/common/enums/alias.enums';

export class VerifyAccountDto {
  @IsEnum(AliasType)
  aliasType: AliasType;

  @IsString()
  @IsNotEmpty()
  aliasValue: string;
}
