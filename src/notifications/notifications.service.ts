import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Notification } from './entities/notification.entity';
import {
  NotificationStatus,
  NotificationType,
} from 'src/common/enums/notification.enums';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly sns: SNSClient;
  private readonly ses: SESClient;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {
    const region = process.env.AWS_REGION;

    this.sns = new SNSClient({ region });
    this.ses = new SESClient({ region });
  }

  // ----------------------------
  // PRIVATE HELPERS
  // ----------------------------

  private async createNotification(data: Partial<Notification>) {
    const notification = this.notificationRepo.create(data);
    return this.notificationRepo.save(notification);
  }

  private async updateNotificationStatus(
    notification: Notification,
    status: NotificationStatus,
  ) {
    notification.status = status;
    return this.notificationRepo.save(notification);
  }

  // ----------------------------
  // EXTERNAL DELIVERY METHODS
  // ----------------------------

  async sendSms(
    participantId: string,
    phoneNumber: string,
    message: string,
  ): Promise<boolean> {
    const notification = await this.createNotification({
      participantId,
      type: NotificationType.SMS,
      title: 'SMS Alert',
      message,
      status: NotificationStatus.PENDING,
    });

    try {
      await this.sns.send(
        new PublishCommand({
          Message: message,
          PhoneNumber: phoneNumber,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        }),
      );

      await this.updateNotificationStatus(
        notification,
        NotificationStatus.SENT,
      );
      this.logger.log(`SMS sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      await this.updateNotificationStatus(
        notification,
        NotificationStatus.FAILED,
      );
      this.logger.error(
        `Failed to send SMS to ${phoneNumber}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
  async sendEmail(
    participantId: string,
    email: string,
    subject: string,
    body: string,
  ): Promise<boolean> {
    const notification = await this.createNotification({
      participantId,
      type: NotificationType.EMAIL,
      title: subject,
      message: body,
      status: NotificationStatus.PENDING,
    });

    try {
      await this.ses.send(
        new SendEmailCommand({
          Source: process.env.SYSTEM_EMAIL_SENDER || 'noreply@linkpay.sl',
          Destination: {
            ToAddresses: [email],
          },
          Message: {
            Subject: {
              Data: subject,
            },
            Body: {
              Text: {
                Data: body,
              },
            },
          },
        }),
      );

      await this.updateNotificationStatus(
        notification,
        NotificationStatus.SENT,
      );
      this.logger.log(`Email sent to ${email}`);
      return true;
    } catch (error) {
      await this.updateNotificationStatus(
        notification,
        NotificationStatus.FAILED,
      );
      this.logger.error(
        `Failed to send email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  async sendPushNotification(
    participantId: string,
    fcmToken: string,
    title: string,
    body: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    const notification = await this.createNotification({
      participantId,
      type: NotificationType.PUSH,
      title,
      message: body,
      metadata,
      status: NotificationStatus.PENDING,
    });

    try {
      // TODO: Replace with Firebase Admin SDK when FCM is configured
      this.logger.log(
        `[MOCK] Push sent to FCM Token: ${fcmToken} | Title: ${title}`,
      );

      await this.updateNotificationStatus(
        notification,
        NotificationStatus.SENT,
      );
      return true;
    } catch (error) {
      await this.updateNotificationStatus(
        notification,
        NotificationStatus.FAILED,
      );
      this.logger.error(
        'Failed to send push notification',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
  async createInAppNotification(
    participantId: string,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    return this.createNotification({
      participantId,
      type: NotificationType.IN_APP,
      title,
      message,
      metadata,
      status: NotificationStatus.SENT,
    });
  }

  // ----------------------------
  // IN-APP INBOX METHODS
  // ----------------------------

  async getUserNotifications(
    participantId: string,
    limit = 50,
    offset = 0,
  ): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { participantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getUnreadCount(participantId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { participantId, isRead: false },
    });
  }

  async markAsRead(
    participantId: string,
    notificationId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, participantId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await this.notificationRepo.save(notification);
    }

    return notification;
  }

  async markAllAsRead(
    participantId: string,
  ): Promise<{ success: true; message: string }> {
    await this.notificationRepo.update(
      { participantId, isRead: false },
      { isRead: true },
    );

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }
}
