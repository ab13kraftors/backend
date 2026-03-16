import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wallet_limits')
@Index(['walletId'], { unique: true })
export class WalletLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  dailySendLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  dailyReceiveLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  singleTxLimit: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
