import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { LoanStatus } from 'src/common/enums/loan.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { ApproveLoanDto, RejectLoanDto } from 'src/loan/dto/approve-loan.dto';
import { LoanService } from 'src/loan/loan.service';

@Controller('/api/admin/loans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.LOAN_OFFICER)
export class AdminLoanController {
  constructor(private readonly loanService: LoanService) {}

  @Get('/pending')
  getPending(
    @Participant() participantId: string,
    @Query('status') status?: LoanStatus,
  ) {
    return this.loanService.getAllLoans(status, participantId);
  }

  @Post(':loanId/approve')
  approve(
    @Param('loanId') loanId: string,
    @Participant() participantId: string,
    @Body() dto: ApproveLoanDto,
  ) {
    return this.loanService.approveLoan(loanId, participantId, dto);
  }

  @Post(':loanId/reject')
  reject(
    @Param('loanId') loanId: string,
    @Participant() participantId: string,
    @Body() dto: RejectLoanDto,
  ) {
    return this.loanService.rejectLoan(loanId, participantId, dto);
  }
}
