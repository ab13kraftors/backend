// src/card/entities/card.entity.ts
import { CardBrand } from 'src/common/enums/card.enums';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('cards')
@Index(['ccuuid', 'participantId'])
export class Card {
  @PrimaryGeneratedColumn('uuid')
  cardId: string;

  @Column()
  participantId: string;

  @Column()
  ccuuid: string;

  @Column({ select: false })
  token: string;

  @Column()
  bin: string; // First 6 digits (safe to store)

  @Column()
  last4: string;

  @Column({ type: 'enum', enum: CardBrand })
  brand: CardBrand;

  @Column()
  expMonth: number;

  @Column()
  expYear: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
