import {
  Controller,
  Param,
  Post,
  Body,
  Get,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
@UseGuards(JwtAuthGuard)
@Controller('/api/accounts')
export class AccountsController {
  constructor(
    // Inject Accounts service
    private readonly accService: AccountsService,
  ) {}

  // ================== create ==================
  // Creates a new account for the logged-in participant
  @Post()
  create(@Body() dto: CreateAccountDto, @Participant() participantId: string) {
    return this.accService.create(participantId, dto);
  }

  // ================== find ==================
  // Fetch account details using FIN address
  @Get('address/:finAddress')
  find(@Param('finAddress') fin: string) {
    return this.accService.getByFinAddress(fin);
  }

  // ================== findAll ==================
  // Returns all accounts belonging to logged-in participant
  @Get()
  findAll(@Participant() participantId: string) {
    return this.accService.getAll(participantId);
  }

  // ================== remove ==================
  // Deletes an account owned by the participant
  @Delete(':accountId')
  remove(@Param('accountId') id: string, @Participant() participantId: string) {
    return this.accService.delete(id, participantId);
  }
}
