import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Otp } from './entities/otp.entity';
import { LessThan, Repository } from 'typeorm';
import { CustomerService } from 'src/customer/customer.service';
import { CustomerStatus } from 'src/common/enums/customer.enums';
import { CronExpression } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { NotificationsService } from 'src/notifications/notifications.service';
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(Otp)
    private readonly otpRepo: Repository<Otp>,

    private readonly customerService: CustomerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ================= GENERATE =================
  async generate(
    participantId: string,
    customerId: string,
    purpose: string = 'REGISTER',
  ) {
    const customer = await this.customerService.findOne(
      customerId,
      participantId,
    );

    // RATE LIMIT (1 OTP / 30 sec)
    const lastOtp = await this.otpRepo.findOne({
      where: { customerId, participantId },
      order: { createdAt: 'DESC' },
    });

    if (lastOtp && Date.now() - lastOtp.createdAt.getTime() < 30000) {
      throw new BadRequestException('Too many requests. Try after 30 seconds');
    }

    // delete previous OTPs
    await this.otpRepo.delete({ customerId, participantId });

    const otpCode = crypto.randomInt(100000, 999999).toString();

    const otp = this.otpRepo.create({
      customerId,
      participantId,
      otpCode,
      purpose,
      attempts: 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await this.otpRepo.save(otp);

    // send notification
    if (customer.msisdn) {
      await this.notificationsService.sendSms(
        participantId,
        customer.msisdn,
        `Your OTP is ${otpCode}`,
      );
    }

    if (customer.firstEmail) {
      await this.notificationsService.sendEmail(
        participantId,
        customer.firstEmail,
        'OTP Verification',
        `Your OTP is ${otpCode}`,
      );
    }

    return {
      message: 'OTP sent',
      expiresAt: otp.expiresAt,
    };
  }

  // ================= VERIFY =================
  async verify(
    participantId: string,
    customerId: string,
    otpCode: string,
    purpose: string,
  ) {
    const otp = await this.otpRepo.findOne({
      where: { customerId, participantId, purpose },
    });

    if (!otp) throw new BadRequestException('OTP not found');

    if (otp.expiresAt < new Date()) {
      await this.otpRepo.delete({ otpId: otp.otpId });
      throw new BadRequestException('OTP expired');
    }

    if (otp.attempts >= 5) {
      throw new BadRequestException('Too many attempts');
    }

    if (otp.otpCode !== otpCode) {
      otp.attempts += 1;
      await this.otpRepo.save(otp);
      throw new BadRequestException('Invalid OTP');
    }

    await this.otpRepo.delete({ otpId: otp.otpId });

    return { success: true };
  }

  // ================= COMPLETE (ACTIVATE) =================
  async completeRegistration(
    participantId: string,
    customerId: string,
    otpCode: string,
  ) {
    await this.verify(participantId, customerId, otpCode, 'REGISTER');

    const customer = await this.customerService.findOne(
      customerId,
      participantId,
    );

    customer.status = CustomerStatus.ACTIVE;

    return this.customerService.updateStatus(customer);
  }

  // ================== cleanExpiredOtps ==================
  // Scheduled job to remove expired OTP records
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanExpiredOtps() {
    const result = await this.otpRepo.delete({
      expiresAt: LessThan(new Date()),
    });

    const count = result?.affected ?? 0;

    if (count > 0) this.logger.log(`Cleaned ${count} expired OTPs`);
  }
}
