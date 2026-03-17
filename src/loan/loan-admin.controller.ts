import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { LoanService } from './loan.service';
import { ApproveLoanDto, RejectLoanDto } from './dto/approve-loan.dto';
import { LoanStatus } from 'src/common/enums/loan.enums';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';

@Controller('admin/loan')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.LOAN_OFFICER)
export class LoanAdminController {
  constructor(private readonly loanService: LoanService) {}

  @Get()
  listAll(
    @Query('status') status?: LoanStatus,
    @Query('participantId') participantId?: string,
  ) {
    return this.loanService.getAllLoans(status, participantId);
  }

  @Post(':loanId/approve')
  approve(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: ApproveLoanDto,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.approveLoan(loanId, req.user.adminId, dto);
  }

  @Post(':loanId/reject')
  reject(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: RejectLoanDto,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.rejectLoan(loanId, req.user.adminId, dto);
  }

  @Post(':loanId/disburse')
  @Roles(Role.ADMIN)
  disburse(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.disburseLoan(loanId, req.user.adminId);
  }
}
