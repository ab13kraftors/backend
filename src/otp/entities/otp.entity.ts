import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('otps')
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  otpId: string;

  @Column()
  customerId: string;

  @Column()
  participantId: string;

  @Column()
  otpCode: string;

  @Column()
  purpose: string; // REGISTER, LOGIN, PAYMENT, MFA

  @Column({ default: 0 })
  attempts: number;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
