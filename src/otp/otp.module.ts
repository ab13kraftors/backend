import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Otp } from './entities/otp.entity';
import { CustomerModule } from 'src/customer/customer.module';
import { SmsModule } from 'src/common/sms/sms.module';
import { EmailModule } from 'src/common/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Otp]),
    CustomerModule,
    SmsModule,
    EmailModule,
  ],
  providers: [OtpService],
  controllers: [OtpController],
  exports: [OtpService],
})
export class OtpModule {}
