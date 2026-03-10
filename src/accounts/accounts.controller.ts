import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('api/accounts')
@UseGuards(JwtAuthGuard, ParticipantGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  async create(
    @Body() dto: CreateAccountDto,
    @Participant() participantId: string,
  ) {
    return this.accountsService.create(participantId, dto);
  }

  @Get('address/:finAddress')
  async getByFinAddress(@Param('finAddress') finAddress: string) {
    return this.accountsService.getByFinAddress(finAddress);
  }

  @Get()
  async getMyAccounts(@Participant() participantId: string) {
    return this.accountsService.getAll(participantId);
  }

  @Delete(':accountId')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('accountId') accountId: string,
    @Participant() participantId: string,
  ) {
    await this.accountsService.close(accountId, participantId);
    return { message: 'Account closed successfully' };
  }
}