import { AliasType } from 'src/common/enums/alias.enums';
import { RtpStatus } from 'src/common/enums/rtp.enums';
import { Currency } from 'src/common/enums/transaction.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('rtp_requests')
@Index(['participantId', 'payerAlias', 'status'])
@Index(['participantId', 'requesterAlias', 'status'])
export class RTP {
  @PrimaryGeneratedColumn('uuid')
  rtpMsgId: string;

  @Column()
  participantId: string;

  @Column()
  requesterAlias: string;

  @Column({ type: 'enum', enum: AliasType, default: AliasType.MSISDN })
  requesterAliasType: AliasType;

  @Column()
  payerAlias: string;

  @Column({ type: 'enum', enum: AliasType, default: AliasType.MSISDN })
  payerAliasType: AliasType;

  @Column({ nullable: true })
  requesterFinAddress?: string;

  @Column({ nullable: true })
  payerFinAddress?: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: '0.00',
  })
  amount: string;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({ nullable: true })
  message?: string;

  @Column({ nullable: true })
  reference?: string;

  @Column({ type: 'enum', enum: RtpStatus, default: RtpStatus.PENDING })
  status: RtpStatus;

  @Column({ nullable: true })
  approvedTxId?: string;

  @Column({ nullable: true })
  rejectionReason?: string;

  @Column({ nullable: true })
  failureReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
