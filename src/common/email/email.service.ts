import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendOtp(email: string, otpCode: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Your LINKPAY Verification Code',
        text: `Your verification code is: ${otpCode}. Valid for 5 minutes.`,
        html: `<b>Your LINKPAY verification code is: <span style="color: blue;">${otpCode}</span></b><p>Valid for 5 minutes.</p>`,
      });
      this.logger.log(`OTP Email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}`, error);
    }
  }
}
