import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wallet_limits')
export class WalletLimit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
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
