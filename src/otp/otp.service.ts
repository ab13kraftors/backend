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
  private readonly logger = new Logger(OtpService.name);
  constructor(
    @InjectRepository(Otp)
    private readonly otpRepo: Repository<Otp>,
    private readonly customerService: CustomerService,
  ) {}

  async generate(participantId: string, ccuuid: string) {
    await this.customerService.findOne(ccuuid, participantId);

    // remove previous otp
    await this.otpRepo.delete({ participantId, ccuuid });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const otp = this.otpRepo.create({
      participantId,
      ccuuid,
      otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    return this.otpRepo.save(otp);
  }

  async complete(participantId: string, ccuuid: string, otpCode: string) {
    const otp = await this.otpRepo.findOne({
      where: {
        participantId,
        ccuuid,
        otpCode,
      },
    });

    if (!otp) {
      throw new BadRequestException('Invalid Otp');
    }
    if (otp.expiresAt < new Date()) {
      await this.otpRepo.delete({ uuid: otp.uuid });
      throw new BadRequestException('OTP expired');
    }

    // delete otp after use
    await this.otpRepo.delete({ uuid: otp.uuid });

    const customer = await this.customerService.findOne(ccuuid, participantId);
    customer.status = CustomerStatus.ACTIVE;

    this.logger.log(`Customer/Company ${ccuuid} activated via OTP.`);
    return this.customerService.updateStatus(customer);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanExpiredOtps() {
    const twoHrsAgo = new Date();
    twoHrsAgo.setHours(twoHrsAgo.getHours() - 2);

    const now = new Date();

    const result = await this.otpRepo.delete({
      expiresAt: LessThan(now),
      createdAt: LessThan(twoHrsAgo),
    });

    const affectedRows = result?.affected ?? 0; // safety we compare number

    if (affectedRows > 0) {
      this.logger.debug(`Cron: Purged ${affectedRows} stale OTP records.`);
    }
  }
}
