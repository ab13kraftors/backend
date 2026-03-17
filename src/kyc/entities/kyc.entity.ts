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
  Index,
} from 'typeorm';

@Entity('kyc_records')
@Index(['participantId', 'customerId'], { unique: true })
export class KycRecord {
  @PrimaryGeneratedColumn('uuid')
  kycId: string;

  @Column()
  customerId: string;

  @Column()
  participantId: string;

  // SOFT
  @Column({ nullable: true }) fullName?: string;

  @Column({ type: 'date', nullable: true }) dateOfBirth?: Date;
  @Column({ nullable: true }) nationality?: string;
  @Column({ nullable: true }) idNumber?: string;
  @Column({ type: 'enum', enum: KycDocumentType, nullable: true })
  idDocumentType?: KycDocumentType;
  @Column({ type: 'date', nullable: true }) idExpiryDate?: Date;

  // HARD
  @Column({ nullable: true }) addressLine1?: string;
  @Column({ nullable: true }) addressLine2?: string;
  @Column({ nullable: true }) city?: string;
  @Column({ nullable: true }) state?: string;
  @Column({ nullable: true }) postalCode?: string;
  @Column({ nullable: true }) country?: string;

  @Column({ nullable: true }) idFrontPath?: string;
  @Column({ nullable: true }) idBackPath?: string;
  @Column({ nullable: true }) selfiePath?: string;
  @Column({ nullable: true }) addressProofPath?: string;

  @Column({ type: 'enum', enum: KycTier, default: KycTier.NONE })
  tier: KycTier;

  @Column({ nullable: true }) reviewedBy?: string;
  @Column({ type: 'timestamp', nullable: true }) reviewedAt?: Date;

  @Column({ type: 'enum', enum: KycRejectionReason, nullable: true })
  rejectionReason?: KycRejectionReason | null;

  @Column({ nullable: true }) rejectionNote?: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @Column({ nullable: true }) lastUpdatedBy: string;
}
