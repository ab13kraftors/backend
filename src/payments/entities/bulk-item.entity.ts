import { Currency } from 'src/common/enums/transaction.enums';
import { Column, PrimaryGeneratedColumn, Entity, Index } from 'typeorm';

export enum ItemStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('bulk_items')
@Index(['bulkId', 'status'])
export class BulkItem {
  @PrimaryGeneratedColumn('uuid')
  itemId: string;

  @Index()
  @Column()
  bulkId: string;

  @Column({ nullable: true })
  txId?: string;

  @Column()
  senderAlias: string;

  @Column()
  receiverAlias: string;

  @Column({ nullable: true })
  receiverFinAddress?: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: '0.00' })
  amount: string;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({ type: 'enum', enum: ItemStatus, default: ItemStatus.FAILED })
  status: ItemStatus;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  uploadedBy?: string;
}
