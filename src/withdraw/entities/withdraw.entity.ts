import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  withdrawalId: string;

  @Column()
  participantId: string;

  @Column()
  walletId: string;

  @Column()
  ccuuid: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: string;

  @Column()
  destination: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
