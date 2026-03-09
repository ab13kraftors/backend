import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Otp } from './entities/otp.entity';
import { LessThan, Repository } from 'typeorm';
import { CustomerService } from 'src/customer/customer.service';
import { CustomerStatus } from 'src/common/enums/customer.enums';
import { CronExpression } from '@nestjs/schedule';
import { Cron } from '@nestjs/schedule';

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
  ) {}

  // ================== generate ==================
  // Generates OTP for customer verification
  async generate(participantId: string, ccuuid: string) {
    // Ensure customer exists
    await this.customerService.findOne(ccuuid, participantId);

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

    // TODO: send OTP via SMS/email instead of returning in API

    return this.otpRepo.save(otp);
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
