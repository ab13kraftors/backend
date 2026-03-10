import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycRecord } from './entities/kyc.entity';
import { KycTier, KycRejectionReason } from 'src/common/enums/kyc.enums';
import { SoftKycDto } from './dto/soft-kyc.dto';
import { HardKycDto } from './dto/hard-kyc.dto';
import { RejectKycDto } from './dto/review-kyc.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycRecord)
    private kycRepo: Repository<KycRecord>,
  ) {}

  // ── CUSTOMER: Submit Soft KYC ─────────────────────────────────
  // Auto-approves — no manual review needed for basic identity info
  async submitSoft(ccuuid: string, participantId: string, dto: SoftKycDto) {
    let record = await this.kycRepo.findOne({ where: { ccuuid } });

    if (
      record &&
      ![KycTier.NONE, KycTier.HARD_REJECTED].includes(record.tier)
    ) {
      throw new BadRequestException(
        `Soft KYC already submitted. Current status: ${record.tier}`,
      );
    }

    if (!record) {
      record = this.kycRepo.create({ ccuuid, participantId });
    }

    Object.assign(record, {
      fullName: dto.fullName,
      dateOfBirth: new Date(dto.dateOfBirth),
      nationality: dto.nationality,
      idNumber: dto.idNumber,
      idDocumentType: dto.idDocumentType,
      idExpiryDate: new Date(dto.idExpiryDate),
      tier: KycTier.SOFT_APPROVED, // auto-approve soft KYC
    });

    await this.kycRepo.save(record);
    return {
      kycId: record.kycId,
      tier: record.tier,
      message: 'Soft KYC approved. You can now access basic wallet features.',
    };
  }

  // ── CUSTOMER: Submit Hard KYC ─────────────────────────────────
  // Requires soft KYC to be approved first
  // Files uploaded via Multer — stored locally or on S3
  async submitHard(
    ccuuid: string,
    participantId: string,
    dto: HardKycDto,
    files: {
      idFront?: Express.Multer.File[];
      idBack?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
      addressProof?: Express.Multer.File[];
    },
  ) {
    const record = await this.kycRepo.findOne({ where: { ccuuid } });

    if (!record || record.tier !== KycTier.SOFT_APPROVED) {
      throw new BadRequestException(
        'Soft KYC must be approved before submitting Hard KYC.',
      );
    }

    // Validate required files
    if (!files.idFront?.[0])
      throw new BadRequestException('ID front image is required');
    if (!files.selfie?.[0])
      throw new BadRequestException('Selfie image is required');

    // Save file paths
    const storePaths = await this.storeFiles(ccuuid, files);

    Object.assign(record, {
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city: dto.city,
      state: dto.state,
      postalCode: dto.postalCode,
      country: dto.country,
      idFrontPath: storePaths.idFront,
      idBackPath: storePaths.idBack,
      selfiePath: storePaths.selfie,
      addressProofPath: storePaths.addressProof,
      tier: KycTier.HARD_PENDING,
      rejectionReason: null,
      rejectionNote: null,
    });

    await this.kycRepo.save(record);
    return {
      kycId: record.kycId,
      tier: record.tier,
      message: 'Hard KYC submitted. Pending admin review.',
    };
  }

  // ── CUSTOMER: Get own KYC status ──────────────────────────────
  async getStatus(ccuuid: string) {
    const record = await this.kycRepo.findOne({ where: { ccuuid } });
    if (!record) return { tier: KycTier.NONE, message: 'No KYC submitted yet' };

    return {
      kycId: record.kycId,
      tier: record.tier,
      rejectionReason: record.rejectionReason ?? null,
      rejectionNote: record.rejectionNote ?? null,
      updatedAt: record.updatedAt,
    };
  }

  // ── ADMIN: Get all pending Hard KYC records ───────────────────
  async getPendingReviews() {
    return this.kycRepo.find({
      where: { tier: KycTier.HARD_PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  // ── ADMIN: Get single record ──────────────────────────────────
  async getRecord(kycId: string) {
    const record = await this.kycRepo.findOne({ where: { kycId } });
    if (!record) throw new NotFoundException('KYC record not found');
    return record;
  }

  // ── ADMIN: Approve Hard KYC ───────────────────────────────────
  async approveHard(kycId: string, adminId: string) {
    const record = await this.getRecord(kycId);

    if (record.tier !== KycTier.HARD_PENDING) {
      throw new BadRequestException(
        `Cannot approve. Current status: ${record.tier}`,
      );
    }

    record.tier = KycTier.HARD_APPROVED;
    record.reviewedBy = adminId;
    record.reviewedAt = new Date();
    record.rejectionReason = undefined;
    record.rejectionNote = undefined;

    await this.kycRepo.save(record);
    return { kycId, tier: record.tier, message: 'Hard KYC approved' };
  }

  // ── ADMIN: Reject Hard KYC ────────────────────────────────────
  async rejectHard(kycId: string, adminId: string, dto: RejectKycDto) {
    const record = await this.getRecord(kycId);

    if (record.tier !== KycTier.HARD_PENDING) {
      throw new BadRequestException(
        `Cannot reject. Current status: ${record.tier}`,
      );
    }

    // Rejected → customer must re-submit hard KYC
    record.tier = KycTier.HARD_REJECTED;
    record.reviewedBy = adminId;
    record.reviewedAt = new Date();
    record.rejectionReason = dto.reason;
    record.rejectionNote = dto.note ?? undefined;

    await this.kycRepo.save(record);
    return { kycId, tier: record.tier, message: 'Hard KYC rejected' };
  }

  // ── INTERNAL: gate check used by other services ───────────────
  // Call this before allowing Cards or Loans
  async requireTier(ccuuid: string, required: KycTier) {
    const record = await this.kycRepo.findOne({ where: { ccuuid } });
    const tier = record?.tier ?? KycTier.NONE;

    const order = [
      KycTier.NONE,
      KycTier.SOFT_PENDING,
      KycTier.SOFT_APPROVED,
      KycTier.HARD_PENDING,
      KycTier.HARD_APPROVED,
    ];

    const currentIdx = order.indexOf(tier);
    const requiredIdx = order.indexOf(required);

    if (currentIdx < requiredIdx) {
      throw new ForbiddenException(
        `This feature requires ${required} KYC. Your current level is ${tier}.`,
      );
    }
  }

  // ── PRIVATE: file storage ─────────────────────────────────────
  private async storeFiles(
    ccuuid: string,
    files: {
      idFront?: Express.Multer.File[];
      idBack?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
      addressProof?: Express.Multer.File[];
    },
  ) {
    const storage = process.env.KYC_STORAGE ?? 'local';

    if (storage === 'local') {
      return this.storeLocal(ccuuid, files);
    }

    // TODO: swap to S3 in production
    // return this.storeS3(ccuuid, files);
    return this.storeLocal(ccuuid, files);
  }

  private async storeLocal(ccuuid: string, files: any) {
    const base = path.resolve(process.env.KYC_UPLOAD_PATH ?? './uploads/kyc');
    const dir = path.join(base, ccuuid);
    fs.mkdirSync(dir, { recursive: true });

    const save = (
      file?: Express.Multer.File,
      name?: string,
    ): string | undefined => {
      if (!file) return undefined;
      const ext = path.extname(file.originalname) || '.jpg';
      const filePath = path.join(dir, `${name}${ext}`);
      fs.writeFileSync(filePath, file.buffer);
      return filePath;
    };

    return {
      idFront: save(files.idFront?.[0], 'id_front'),
      idBack: save(files.idBack?.[0], 'id_back'),
      selfie: save(files.selfie?.[0], 'selfie'),
      addressProof: save(files.addressProof?.[0], 'address_proof'),
    };
  }
}
