import { AliasType } from 'src/common/enums/alias.enums';
import { RtpStatus } from 'src/common/enums/rtp.enums';
import { Currency } from 'src/common/enums/transaction.enums';
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

  @Column({ type: 'enum', enum: AliasType, default: AliasType.MSISDN })
  requesterAliasType: AliasType;

  @Column()
  payerAlias: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column()
  message: string;

  @Column({ type: 'enum', enum: RtpStatus, default: RtpStatus.PENDING })
  status: RtpStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;
}
