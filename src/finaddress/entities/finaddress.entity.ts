import { ServicerIdType, Type } from 'src/common/enums/finaddress.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Unique(['participantId', 'finAddress']) // prevents duplicate
export class FinAddress {
  @PrimaryGeneratedColumn('uuid')
  finUuid: string;

  @Column()
  participantId: string;

  @Column()
  ccuuid: string;

  @Column({ type: 'enum', enum: Type, default: Type.BANK_ACCOUNT })
  type: Type;

  @Column()
  finAddress: string;

  @Column({ type: 'enum', enum: ServicerIdType, default: ServicerIdType.BIC })
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
