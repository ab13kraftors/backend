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

  /**
   * GET /admin/loan
   * List all loans. Optional filters: ?status=PENDING&participantId=xxx
   */
  @Get()
  listAll(
    @Query('status') status?: LoanStatus,
    @Query('participantId') participantId?: string,
  ) {
    return this.loanService.getAllLoans(status, participantId);
  }

  /**
   * POST /admin/loan/:loanId/approve
   * Approve a PENDING loan application and set the approved amount + due date.
   */
  @Post(':loanId/approve')
  approve(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: ApproveLoanDto,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.approveLoan(loanId, req.user.adminId, dto);
  }

  /**
   * POST /admin/loan/:loanId/reject
   * Reject a PENDING loan application.
   */
  @Post(':loanId/reject')
  reject(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: RejectLoanDto,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.rejectLoan(loanId, req.user.adminId, dto);
  }

  /**
   * POST /admin/loan/:loanId/disburse
   * Disburse an APPROVED loan into the customer's wallet via the ledger engine.
   * Idempotent — the ledger key `disburse-{loanId}` prevents double-disbursement.
   */
  @Post(':loanId/disburse')
  @Roles(Role.ADMIN) // Disburse is ADMIN-only, not LOAN_OFFICER
  disburse(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { adminId: string } },
  ) {
    return this.loanService.disburseLoan(loanId, req.user.adminId);
  }
}
