import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AccountsService } from 'src/accounts/accounts.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { AccountStatus } from 'src/accounts/enums/account.enum';

@Controller('/api/admin/accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminAccountController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get(':accountId')
  get(@Param('accountId') id: string, @Participant() participantId: string) {
    return this.accountsService.findById(id, participantId);
  }

  @Patch(':accountId/freeze')
  freeze(@Param('accountId') id: string, @Participant() participantId: string) {
    return this.accountsService.updateStatus(
      id,
      participantId,
      AccountStatus.BLOCKED,
    );
  }

  @Patch(':accountId/unfreeze')
  unfreeze(
    @Param('accountId') id: string,
    @Participant() participantId: string,
  ) {
    return this.accountsService.updateStatus(
      id,
      participantId,
      AccountStatus.ACTIVE,
    );
  }
}
