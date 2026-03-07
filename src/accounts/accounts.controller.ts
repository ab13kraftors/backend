import {
  Controller,
  Param,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common'; // Added Req
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';

@UseGuards(JwtAuthGuard, ParticipantGuard)
@Controller('/api/accounts')
export class AccountsController {
  constructor(private readonly accService: AccountsService) {}

  @Post()
  create(@Body() dto: CreateAccountDto, @Req() req: any) {
    const participantId = req.participantId;
    return this.accService.create(participantId, dto);
  }

  @Get('address/:finAddress')
  find(@Param('finAddress') fin: string) {
    return this.accService.getByFinAddress(fin);
  }

  // accounts.controller.ts

  @Get()
  findAll(@Req() req: any) {
    // Filters accounts by the bank (participant) logged in
    const participantId = req.participantId;
    return this.accService.getAll(participantId);
  }

  @Delete(':accountId')
  remove(@Param('accountId') id: string) {
    return this.accService.delete(id);
  }
}
