import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Otp } from './entities/otp.entity';
import { LessThan, Repository } from 'typeorm';
import { CustomerService } from 'src/customer/customer.service';
import { CustomerStatus } from 'src/common/enums/customer.enums';
import { CronExpression } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';
import { SmsService } from 'src/common/sms/sms.service';
import { EmailService } from 'src/common/email/email.service';

@Injectable()
export class OtpService {
  // Logger for OTP operations
  private readonly logger = new Logger(OtpService.name);

  constructor(
    // Inject OTP repository
    @InjectRepository(Otp)
    private readonly otpRepo: Repository<Otp>,

    // Inject Customer service
    private readonly customerService: CustomerService,

    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
  ) {}

  // ================== generate ==================
  // Generates OTP for customer verification
  async generate(participantId: string, ccuuid: string) {
    // Ensure customer exists
    const customer = await this.customerService.findOne(ccuuid, participantId);

    if (!customer.firstEmail) {
      throw new BadRequestException(
        'Customer does not have a registered email address.',
      );
    }

    // Remove any previous OTP
    await this.otpRepo.delete({ participantId, ccuuid });

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create OTP entity with 5 minute expiry
    const otp = this.otpRepo.create({
      participantId,
      ccuuid,
      otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const saved = await this.otpRepo.save(otp);

    // Deliver OTP to customer registered msisdn
    // await this.smsService.sendOtp(customer.msisdn, otpCode);
    // Deliver OTP to customer registered email instead of MSISDN
    await this.emailService.sendOtp(customer.firstEmail, otpCode);

    // Never return otpCode in response
    return {
      uuid: saved.uuid,
      ccuuid: saved.ccuuid,
      expiresAt: saved.expiresAt,
      message: 'OTP sent to registered email/msisdn',
    };
  }

  // ================== complete ==================
  // Verifies OTP and activates customer
  async complete(participantId: string, ccuuid: string, otpCode: string) {
    const otp = await this.otpRepo.findOne({
      where: {
        participantId,
        ccuuid,
        otpCode,
      },
    });

    // Validate OTP existence
    if (!otp) {
      throw new BadRequestException('Invalid Otp');
    }

    // Check OTP expiration
    if (otp.expiresAt < new Date()) {
      await this.otpRepo.delete({ uuid: otp.uuid });
      throw new BadRequestException('OTP expired');
    }

    // Delete OTP after successful verification
    await this.otpRepo.delete({ uuid: otp.uuid });

    // Activate customer
    const customer = await this.customerService.findOne(ccuuid, participantId);
    customer.status = CustomerStatus.ACTIVE;

    this.logger.log(`Customer/Company ${ccuuid} activated via OTP.`);

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
