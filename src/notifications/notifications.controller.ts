import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Participant } from '../common/decorators/participant/participant.decorator';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Participant() participantId: string,
    @Query() query: GetNotificationsQueryDto,
  ) {
    const { limit = 50, offset = 0 } = query;

    const data = await this.notificationsService.getUserNotifications(
      participantId,
      limit,
      offset,
    );

    const unreadCount =
      await this.notificationsService.getUnreadCount(participantId);

    return {
      unreadCount,
      data,
    };
  }

  @Patch(':id/read')
  async markAsRead(
    @Participant() participantId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(participantId, notificationId);
  }

  @Patch('read-all')
  async markAllAsRead(@Participant() participantId: string) {
    return this.notificationsService.markAllAsRead(participantId);
  }
}
