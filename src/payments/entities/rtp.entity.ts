import { Currency, RtpStatus } from 'src/common/enums/rtp.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('rtp_requests')
export class RTP {
  @PrimaryGeneratedColumn('uuid')
  rtpMsgId: string;

  @Column()
  participantId: string;

  @Column()
  requesterAlias: string;

  @Column()
  payerAlias: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column()
  message: string;

  @Column({ type: 'enum', enum: RtpStatus })
  status: RtpStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;
}
