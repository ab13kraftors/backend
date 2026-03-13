import {
  CustomerType,
  LinkageType,
  CustomerStatus,
  Gender,
  DocumentType,
} from 'src/common/enums/customer.enums';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Alias } from 'src/alias/entities/alias.entity';
import { FinAddress } from 'src/finaddress/entities/finaddress.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @OneToMany(() => Alias, (alias) => alias.customer)
  aliases: Alias[];

  @OneToMany(() => FinAddress, (finAddress) => finAddress.customer)
  finAddresses: FinAddress[];

  // One company id share by multiple customers
  @Column()
  participantId: string;

  @Column({ type: 'enum', enum: CustomerType })
  type: CustomerType;

  @Column()
  externalId: string;

  @Column({ type: 'enum', enum: LinkageType })
  linkageType: LinkageType;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.INACTIVE,
  })
  status: CustomerStatus;

  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.NATIONAL_ID,
  })
  documentType: DocumentType;

  @Column()
  documentId: string;

  @Column({ type: 'timestamp' })
  documentValidityDate: Date;

  @Column()
  msisdn: string;

  @Column({ nullable: true, type: 'boolean' })
  msisdnIsOwned?: boolean;

  @Column({ nullable: true, select: false })
  pinHash?: string;

  // INDIVIDUAL-only============================
  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender?: Gender;

  @Column({ type: 'date', nullable: true })
  dob?: Date;

  @Column({ nullable: true })
  firstEmail?: string;

  @Column({ nullable: true })
  secondEmail?: string;

  // COMPANY-only==============================
  @Column({ nullable: true })
  companyName?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdDate: Date;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  modifiedDate?: Date;
}
