import { Injectable, NotFoundException } from '@nestjs/common';
import { CasService } from 'src/cas/cas.service';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { AccountsService } from 'src/accounts/accounts.service';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class VerifyService {
  constructor(
    private readonly cas: CasService,
    private readonly accountsService: AccountsService,
    private readonly walletService: WalletService,
  ) {}

  async verifyAccount(dto: VerifyAccountDto) {
    const result = await this.cas.resolveAlias(dto.aliasType, dto.aliasValue);

    const account = await this.accountsService.findByFinAddress(
      result.finAddress,
    );

    if (account) {
      return {
        verified: true,
        type: 'ACCOUNT',
        finAddress: account.finAddress,
        aliasType: dto.aliasType,
        aliasValue: dto.aliasValue,
        accountId: account.accountId,
        customerId: account.customerId ?? null,
        accountNumber: account.accountNumber ?? null,
        currency: account.currency,
        status: account.status,
        message: 'Account verified successfully',
      };
    }

    const wallet = await this.walletService.findByFinAddress(result.finAddress);

    if (wallet) {
      return {
        verified: true,
        type: 'WALLET',
        finAddress: wallet.finAddress,
        aliasType: dto.aliasType,
        aliasValue: dto.aliasValue,
        walletId: wallet.walletId,
        customerId: wallet.customerId,
        currency: wallet.currency,
        status: wallet.status,
        message: 'Wallet verified successfully',
      };
    }

    throw new NotFoundException(
      'Resolved alias but destination record not found',
    );
  }
}
