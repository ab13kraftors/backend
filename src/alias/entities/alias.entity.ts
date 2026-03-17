import { AliasStatus, AliasType } from 'src/common/enums/alias.enums';
import { Customer } from 'src/customer/entities/customer.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';

@Entity('aliases')
@Index(['participantId', 'type', 'value'], { unique: true })
export class Alias {
  @PrimaryGeneratedColumn('uuid')
  aliasId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.aliases, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'enum', enum: AliasType })
  type: AliasType;

  @Column()
  value: string;

  @Column({ type: 'enum', enum: AliasStatus, default: AliasStatus.ACTIVE })
  status: AliasStatus;

  @Column({ default: true })
  isPrimary: boolean;

  @CreateDateColumn()
  createdAt: Date;
}