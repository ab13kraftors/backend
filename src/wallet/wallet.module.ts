import { Module, forwardRef } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from 'src/payments/entities/transaction.entity';
import { AccountsModule } from 'src/accounts/accounts.module';
import { CustomerModule } from 'src/customer/customer.module';
import { WalletLimit } from './entities/wallet-limit.entity';
import { LedgerModule } from 'src/ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, WalletLimit]),
    AccountsModule,
    LedgerModule,
    forwardRef(() => CustomerModule),
  ],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
