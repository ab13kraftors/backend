import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('compliance_logs')
export class ComplianceLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() action: string; // e.g., 'login', 'txn_create'
  @Column() userId: string;
  @Column() participantId: string;
  @Column('json', { nullable: true }) metadata: any; // e.g., { ip, amount }
  @CreateDateColumn() timestamp: Date;
  @Column({ default: false }) reported: boolean; // For SAR
}
