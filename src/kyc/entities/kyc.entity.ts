import {
  KycTier,
  KycDocumentType,
  KycRejectionReason,
} from 'src/common/enums/kyc.enums';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('kyc_records')
export class KycRecord {
  @PrimaryGeneratedColumn('uuid')
  kycId: string;

  @Column({ unique: true })
  ccuuid: string; // one KYC record per customer

  @Column()
  participantId: string;

  // ── SOFT KYC FIELDS ──────────────────────────────────────────
  @Column({ nullable: true })
  fullName?: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth?: Date;

  @Column({ nullable: true })
  nationality?: string;

  @Column({ nullable: true })
  idNumber?: string; // National ID / Passport number

  @Column({ type: 'enum', enum: KycDocumentType, nullable: true })
  idDocumentType?: KycDocumentType;

  @Column({ type: 'date', nullable: true })
  idExpiryDate?: Date;

  // ── HARD KYC FIELDS ──────────────────────────────────────────
  @Column({ nullable: true })
  addressLine1?: string;

  @Column({ nullable: true })
  addressLine2?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  postalCode?: string;

  @Column({ nullable: true })
  country?: string;

  // Document file paths / S3 keys
  @Column({ nullable: true })
  idFrontPath?: string; // front of ID doc

  @Column({ nullable: true })
  idBackPath?: string; // back of ID doc

  @Column({ nullable: true })
  selfiePath?: string; // liveness selfie

  @Column({ nullable: true })
  addressProofPath?: string; // utility bill / bank statement

  // ── STATUS ────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: KycTier, default: KycTier.NONE })
  tier: KycTier;

  // ── ADMIN REVIEW ─────────────────────────────────────────────
  @Column({ nullable: true })
  reviewedBy?: string; // admin participantId

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ type: 'enum', enum: KycRejectionReason, nullable: true })
  rejectionReason?: KycRejectionReason | null;

  @Column({ type: 'varchar', nullable: true })
  rejectionNote?: string | null; // free text from admin

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
