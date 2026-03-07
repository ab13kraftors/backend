import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { CustomerModule } from './customer/customer.module';
import { OtpModule } from './otp/otp.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AliasModule } from './alias/alias.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { EncryptionInterceptor } from './common/interceptors/encryption.interceptor';
import { AesService } from './common/crypto/aes.service';
import { FinaddressModule } from './finaddress/finaddress.module';
import { PaymentsModule } from './payments/payments.module';
import { CasModule } from './cas/cas.module';
import { AccountsModule } from './accounts/accounts.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 3600000,
        limit: 20,
        // in 1 hr only 20 requests per ip
      },
    ]),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    CustomerModule,
    OtpModule,
    AliasModule,
    AuthModule,
    FinaddressModule,
    PaymentsModule,
    CasModule,
    AccountsModule,
    WalletModule,
  ],
  controllers: [AppController],
  providers: [
    AesService,
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: EncryptionInterceptor,
    },
  ],
})
export class AppModule {}
