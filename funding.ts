
/////////////////////////
// FILE: src/payments/funding/funding.controller.ts
/////////////////////////
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { FundingService } from './funding.service';
import { FundingWalletDto } from './dto/fund-wallet.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/wallet/funding')
export class FundingController {
  constructor(
    // Inject Funding service
    private readonly fundingService: FundingService,
  ) {}

  // ================== fundingWallet ==================
  // Initiates wallet funding request
  @Post('initiate')
  async fundingWallet(
    @Body() dto: FundingWalletDto,
    @Participant() participantId: string,
  ) {
    return this.fundingService.fundingWallet(participantId, dto);
  }
}

/////////////////////////
// FILE: src/payments/funding/funding.module.ts
/////////////////////////
import { Module } from '@nestjs/common';
import { FundingController } from './funding.controller';
import { FundingService } from './funding.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundingWallet } from './entities/funding.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { AuthModule } from 'src/auth/auth.module';
import { LedgerModule } from 'src/ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FundingWallet, Wallet]),
    AuthModule,
    LedgerModule,
  ],
  controllers: [FundingController],
  providers: [FundingService],
})
export class FundingModule {}

/////////////////////////
// FILE: src/payments/funding/funding.service.ts
/////////////////////////
// src/payments/funding/funding.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FundingWallet } from './entities/funding.entity';
import { Wallet } from 'src/wallet/entities/wallet.entity';
import { FundingWalletDto } from './dto/fund-wallet.dto';
import { TransactionStatus } from 'src/common/enums/transaction.enums';
import { LedgerService } from 'src/ledger/ledger.service';
import { SYSTEM_POOL } from 'src/common/constants';

@Injectable()
export class FundingService {
  private readonly SYSTEM_POOL_FIN = SYSTEM_POOL;

  constructor(
    @InjectRepository(FundingWallet)
    private fundingRepo: Repository<FundingWallet>,
    @InjectRepository(Wallet)
    private walletRepo: Repository<Wallet>,
    private readonly ledgerService: LedgerService,
    private readonly dataSource: DataSource, // 1. Inject DataSource
  ) {}

  async fundingWallet(participantId: string, dto: FundingWalletDto) {
    const wallet = await this.walletRepo.findOne({
      where: { walletId: dto.walletId, participantId },
    });

    if (!wallet)
      throw new NotFoundException('Wallet does not exist or access denied');

    // 2. Start Transaction
    return await this.dataSource.transaction(async (manager) => {
      // Create initial record within transaction
      const funding = await manager.save(
        manager.create(FundingWallet, {
          ...dto,
          participantId,
          status: TransactionStatus.INITIATED,
        }),
      );

      // 3. Move funds (Pass the manager!)
      const transfer = await this.ledgerService.postTransfer(
        {
          txId: `FUND-${funding.fundingId}`,
          reference: `Wallet funding for ${dto.walletId}`,
          participantId,
          postedBy: 'system',
          legs: [
            {
              finAddress: this.SYSTEM_POOL_FIN,
              amount: String(dto.amount),
              isCredit: false,
              memo: `Funding wallet ${dto.walletId}`,
            },
            {
              finAddress: wallet.finAddress,
              amount: String(dto.amount),
              isCredit: true,
              memo: `Funded from system pool`,
            },
          ],
        },
        manager,
      );

      // 4. Update status and save
      funding.status = TransactionStatus.COMPLETED;
      await manager.save(funding);

      return {
        fundingId: funding.fundingId,
        status: funding.status,
      };
    });
  }
}

/////////////////////////
// FILE: src/payments/funding/dto/fund-wallet.dto.ts
/////////////////////////
import { IsEnum, IsNumber, IsPositive, IsString } from 'class-validator';
import { FundMethod } from 'src/common/enums/bulk.enums';
import { Currency } from 'src/common/enums/transaction.enums';

export class FundingWalletDto {
  @IsString()
  walletId: string;

  @IsEnum(FundMethod)
  method: FundMethod;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(Currency)
  currency: Currency;
}

/////////////////////////
// FILE: src/payments/funding/entities/funding.entity.ts
/////////////////////////
import { FundMethod } from 'src/common/enums/bulk.enums';
import {
  Currency,
  TransactionStatus,
} from 'src/common/enums/transaction.enums';
import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Entity,
} from 'typeorm';

@Entity('wallet_funding')
export class FundingWallet {
  @PrimaryGeneratedColumn('uuid')
  fundingId: string;

  @Column()
  walletId: string;

  @Column()
  participantId: string;

  @Column({ type: 'enum', enum: FundMethod, default: FundMethod.CARD })
  method: FundMethod;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.SLE })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @CreateDateColumn()
  createdAt: Date;
}
