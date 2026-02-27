import { AliasStatus, AliasType } from 'src/common/enums/alias.enums';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Alias {
  @PrimaryGeneratedColumn('uuid')
  aliasUuid: string;

  @Column()
  participantId: string;

  @Column()
  ccuuid: string;

  @Column({ type: 'enum', enum: AliasType, default: AliasType.EMAIL_ADDRESS })
  type: AliasType;

  @Column()
  value: string;

  @Column({ type: 'enum', enum: AliasStatus, default: 'ACTIVE' })
  status: string;

  @Column({ default: false })
  isOwner: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  expireDate: Date;

  @CreateDateColumn()
  createdAt: Date;
}
