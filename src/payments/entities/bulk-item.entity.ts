import { Currency } from 'src/common/enums/transaction.enums';
import { Column, PrimaryGeneratedColumn, Entity, Index } from 'typeorm';

export enum ItemStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('bulk_items')
export class BulkItem {
  @PrimaryGeneratedColumn('uuid')
  itemId: string;

  @Index()
  @Column()
  bulkId: string; // FK to BulkBatch — add @ManyToOne if joining

  @Column()
  senderAlias: string;

  @Column()
  receiverAlias: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'enum', enum: ItemStatus, default: ItemStatus.FAILED })
  status: ItemStatus;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  uploadedBy: string;
}
