import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('limit_usage')
@Index(['participantId', 'customerId'])
export class LimitUsage {
  @PrimaryGeneratedColumn('uuid')
  usageId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  dailySent: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  dailyReceived: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0' })
  monthlyTotal: string;

  @CreateDateColumn()
  createdAt: Date;
}
