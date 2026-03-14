import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerJournal } from './entities/ledger-journal.entity';
import { LedgerPosting } from './entities/ledger-posting.entity';
import { LedgerService } from './ledger.service';
import { AccountsModule } from 'src/accounts/accounts.module';
import { Account } from 'src/accounts/entities/account.entity';
// import { LedgerController } from './ledger.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerJournal, LedgerPosting, Account]),
    forwardRef(() => AccountsModule),
  ],
  providers: [LedgerService],
  // controllers: [LedgerController],
  exports: [LedgerService],
})
export class LedgerModule {}
