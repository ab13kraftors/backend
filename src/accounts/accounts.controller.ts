import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { AccountType } from './enums/account.enum';
import { Currency } from 'src/common/enums/transaction.enums';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('customer-main')
  async createCustomerMain(@Body() dto: CreateAccountDto) {
    return this.accountsService.createCustomerMainAccount({
      ...dto,
      type: AccountType.CUSTOMER_MAIN,
    });
  }

  @Post('wallet')
  async createWallet(
    @Body() dto: CreateAccountDto,
    @Participant() participantId: string,
  ) {
    return this.accountsService.createWalletAccount(
      {
        ...dto,
        type: AccountType.WALLET,
      },
      participantId,
    );
  }

  @Post('system')
  async createSystem(
    @Body()
    body: {
      participantId: string;
      currency?: Currency;
      finAddress?: string;
    },
  ) {
    return this.accountsService.createSystemAccount(
      body.participantId,
      body.currency ?? Currency.SLE,
      body.finAddress,
    );
  }

  @Get(':accountId')
  async getById(
    @Param('accountId') accountId: string,
    @Participant() participantId: string,
  ) {
    return this.accountsService.findById(accountId, participantId);
  }

  @Get('fin-address/:finAddress')
  async getByFinAddress(@Param('finAddress') finAddress: string) {
    return this.accountsService.findByFinAddress(finAddress);
  }

  @Get('customer/:customerId/main')
  async getCustomerMain(@Param('customerId') customerId: string) {
    return this.accountsService.findCustomerMainAccount(customerId);
  }

  @Get('wallet/:walletId')
  async getWalletAccount(@Param('walletId') walletId: string) {
    return this.accountsService.findWalletAccount(walletId);
  }

  @Get('system/default')
  async getSystemAccount() {
    return this.accountsService.getSystemAccount();
  }

  @Patch(':accountId/status')
  async updateStatus(
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountStatusDto,
    @Participant() participantId: string,
  ) {
    return this.accountsService.updateStatus(
      accountId,
      participantId,
      dto.status,
    );
  }
}

/*For now acceptable, but future fix:

participantId must come from auth
not body */
