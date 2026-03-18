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

  // ── CUSTOMER ROUTES (Dynamic paths last) ────────────────────

  // Get own KYC status
  @Get(':customerId/status')
  @Roles(Role.CUSTOMER)
  getStatus(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ) {
    return this.kycService.getStatus(customerId, participantId);
  }

  // Submit Soft KYC — auto approved
  @Post(':customerId/soft')
  @Roles(Role.CUSTOMER)
  submitSoft(
    @Param('customerId') customerId: string,
    @Body() dto: SoftKycDto,
    @Participant() participantId: string,
  ) {
    return this.kycService.submitSoft(customerId, participantId, dto);
  }

  // Submit Hard KYC — goes to admin review queue
  @Post(':customerId/hard')
  @Roles(Role.CUSTOMER)
  @UseInterceptors(upload)
  submitHard(
    @Param('customerId') customerId: string,
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
    return this.kycService.submitHard(customerId, participantId, dto, files);
  }
}
