import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { KycService } from './kyc.service';
import { SoftKycDto } from './dto/soft-kyc.dto';
import { HardKycDto } from './dto/hard-kyc.dto';
import { RejectKycDto } from './dto/review-kyc.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { memoryStorage } from 'multer';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';

const upload = FileFieldsInterceptor(
  [
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'addressProof', maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
      ];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    },
  },
);

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('/api/fp/kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  // ── 1. ADMIN ROUTES (Static paths first!) ──────────────────────

  @Get('admin/pending') // Must be above :ccuuid routes
  @Roles(Role.ADMIN)
  getPending() {
    return this.kycService.getPendingReviews();
  }

  @Get('admin/:kycId') // Specific admin record
  @Roles(Role.ADMIN)
  getRecord(@Param('kycId') kycId: string) {
    return this.kycService.getRecord(kycId);
  }

  @Post('admin/:kycId/approve')
  @Roles(Role.ADMIN)
  approve(@Param('kycId') kycId: string, @Participant() participantId: string) {
    return this.kycService.approveHard(kycId, participantId);
  }

  @Post('admin/:kycId/reject')
  @Roles(Role.ADMIN)
  reject(
    @Param('kycId') kycId: string,
    @Body() dto: RejectKycDto,
    @Participant() participantId: string,
  ) {
    return this.kycService.rejectHard(kycId, participantId, dto);
  }

  // ── 2. CUSTOMER ROUTES (Dynamic paths last) ────────────────────

  // Get own KYC status
  @Get(':ccuuid/status')
  @Roles(Role.CUSTOMER)
  getStatus(
    @Param('ccuuid') ccuuid: string,
    @Participant() participantId: string,
  ) {
    return this.kycService.getStatus(ccuuid, participantId);
  }

  // Submit Soft KYC — auto approved
  @Post(':ccuuid/soft')
  @Roles(Role.CUSTOMER)
  submitSoft(
    @Param('ccuuid') ccuuid: string,
    @Body() dto: SoftKycDto,
    @Participant() participantId: string,
  ) {
    return this.kycService.submitSoft(ccuuid, participantId, dto);
  }

  // Submit Hard KYC — goes to admin review queue
  @Post(':ccuuid/hard')
  @Roles(Role.CUSTOMER)
  @UseInterceptors(upload)
  submitHard(
    @Param('ccuuid') ccuuid: string,
    @Body() dto: HardKycDto,
    @Participant() participantId: string,
    @UploadedFiles()
    files: {
      idFront?: Express.Multer.File[];
      idBack?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
      addressProof?: Express.Multer.File[];
    },
  ) {
    return this.kycService.submitHard(ccuuid, participantId, dto, files);
  }
}
