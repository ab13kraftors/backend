import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerJournal } from './entities/ledger-journal.entity';
import { LedgerPosting } from './entities/ledger-posting.entity';
import { LedgerService } from './ledger.service';
import { AccountsModule } from 'src/accounts/accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LedgerJournal, LedgerPosting]),
    forwardRef(() => AccountsModule),
  ],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
