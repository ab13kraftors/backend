import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider = process.env.SMS_PROVIDER ?? 'mock';

  async sendOtp(msisdn: string, otpCode: string): Promise<void> {
    const message = `Your LINKPAY verification code is: ${otpCode}. Valid for 5 minutes. Do not share this with anyone.`;
    await this.send(msisdn, message);
  }

  async send(msisdn: string, message: string): Promise<void> {
    switch (this.provider) {
      case 'twilio':
        return this.sendViaTwilio(msisdn, message);
      case 'africastalking':
        return this.sendViaAfricasTalking(msisdn, message);
      case 'mock':
      default:
        this.logger.warn(`[MOCK SMS] To: ${msisdn} | Message: ${message}`);
        return;
    }
  }

  // ── PRIMARY: Twilio (India + international) ──────────────────
  private async sendViaTwilio(msisdn: string, message: string): Promise<void> {
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    );

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_FROM!,
      to: msisdn, // must be E.164 format: +919876543210
    });

    this.logger.log(`SMS sent via Twilio | SID: ${result.sid} | To: ${msisdn}`);
  }

  // ── FALLBACK: Africa's Talking (Sierra Leone / Africa) ───────
  private async sendViaAfricasTalking(
    msisdn: string,
    message: string,
  ): Promise<void> {
    const AfricasTalking = require('africastalking');
    const at = AfricasTalking({
      apiKey: process.env.AT_API_KEY!,
      username: process.env.AT_USERNAME!,
    });

    const result = await at.SMS.send({
      to: [msisdn],
      message,
      from: process.env.AT_SENDER_ID,
    });

    this.logger.log(`SMS sent via AfricasTalking`, result);
  }
}
