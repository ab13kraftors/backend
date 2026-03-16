import { Module, forwardRef } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { LedgerModule } from 'src/ledger/ledger.module';
import { KycModule } from 'src/kyc/kyc.module';
import { ComplianceModule } from 'src/compliance/compliance.module';
import { Participant } from 'src/auth/entities/participant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, Participant]),
    forwardRef(() => LedgerModule),
    KycModule,
    ComplianceModule,
  ],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService, TypeOrmModule],
})
export class AccountsModule {}
