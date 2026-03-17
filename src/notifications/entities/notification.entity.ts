import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  NotificationStatus,
  NotificationType,
} from 'src/common/enums/notification.enums';

@Entity('notifications')
@Index('IDX_NOTIFICATIONS_PARTICIPANT_CREATED_AT', [
  'participantId',
  'createdAt',
])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  participantId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}

/*
@Column({nullable: true})
customerId?: string;    // add tracing

@Column({nullable: true})
referenceId?: string;   // for otpId/txId/mfaId
*/
