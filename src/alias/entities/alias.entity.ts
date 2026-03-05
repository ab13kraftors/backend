import { AliasStatus, AliasType } from 'src/common/enums/alias.enums';
import { Customer } from 'src/customer/entities/customer.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Alias {
  @PrimaryGeneratedColumn('uuid')
  aliasUuid: string;

  @Column()
  participantId: string;

  @ManyToOne(() => Customer, (customer) => customer.aliases, {
    onDelete: 'CASCADE',
    nullable: false, // Cannot create without a customer
  })
  @JoinColumn({ name: 'ccuuid', referencedColumnName: 'uuid' })
  customer: Customer;

  @Column()
  ccuuid: string;

  @Column({ type: 'enum', enum: AliasType, default: AliasType.EMAIL_ADDRESS })
  type: AliasType;

  @Column()
  value: string;

  @Column({ type: 'enum', enum: AliasStatus, default: AliasStatus.ACTIVE })
  status: string;

  @Column({ default: false })
  isOwner: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expireDate?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
