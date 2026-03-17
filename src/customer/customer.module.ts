import { forwardRef, Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { WalletModule } from 'src/wallet/wallet.module';
import { AccountsModule } from 'src/accounts/accounts.module';
import { PaymentInstrumentsModule } from 'src/payment-instruments/payment-instruments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer]),
    forwardRef(() => WalletModule),
    forwardRef(() => AccountsModule),
    forwardRef(() => PaymentInstrumentsModule),
  ],
  providers: [CustomerService],
  controllers: [CustomerController],
  exports: [CustomerService],
})
export class CustomerModule {}