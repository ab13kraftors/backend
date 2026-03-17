import { ServicerIdType, Type } from 'src/common/enums/finaddress.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from 'src/customer/entities/customer.entity';

@Entity('fin_addresses')
@Unique(['participantId', 'finAddress'])
@Index(['participantId', 'customerId'])
export class FinAddress {
  @PrimaryGeneratedColumn('uuid')
  finAddressId: string;

  @Column()
  participantId: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.finAddresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'enum', enum: Type })
  type: Type;

  @Column()
  finAddress: string;

  @Column({ type: 'enum', enum: ServicerIdType })
  servicerIdType: ServicerIdType;

  @Column()
  servicerId: string;

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}