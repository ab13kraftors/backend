import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('limit_configs')
@Index(['participantId', 'level'], { unique: true })
export class LimitConfig {
  @PrimaryGeneratedColumn('uuid')
  configId: string;

  @Column()
  participantId: string;

  @Column()
  level: string; // KYC tier or risk level: LOW, MEDIUM, HIGH

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  dailySendLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  dailyReceiveLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  singleTxLimit: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  monthlyLimit: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
