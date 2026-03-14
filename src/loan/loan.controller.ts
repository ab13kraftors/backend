import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { LoanService } from './loan.service';
import { ApplyLoanDto } from './dto/apply-loan.dto';
import { RepayLoanDto } from './dto/repay-loan.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@Controller('loan')
@UseGuards(JwtAuthGuard, ParticipantGuard)
export class LoanController {
  constructor(private readonly loanService: LoanService) {}

  /**
   * POST /loan/apply
   * Submit a new loan application.
   */
  @Post('apply')
  apply(
    @Participant() participantId: string,
    @Body() dto: ApplyLoanDto,
    @Req() req: Request & { user: { ccuuid: string } },
  ) {
    return this.loanService.applyLoan(req.user.ccuuid, participantId, dto);
  }

  /**
   * GET /loan
   * Retrieve all loans for the authenticated customer.
   */
  @Get()
  getMyLoans(@Req() req: Request & { user: { ccuuid: string } }) {
    return this.loanService.getLoansByCustomer(req.user.ccuuid);
  }

  /**
   * GET /loan/:loanId
   * Retrieve a single loan (must belong to the authenticated customer).
   */
  @Get(':loanId')
  getLoan(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { ccuuid: string } },
  ) {
    return this.loanService.getLoanById(loanId, req.user.ccuuid);
  }

  /**
   * GET /loan/:loanId/repayments
   * Retrieve repayment history for a specific loan.
   */
  @Get(':loanId/repayments')
  getRepayments(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { ccuuid: string } },
  ) {
    return this.loanService.getRepaymentHistory(loanId, req.user.ccuuid);
  }

  /**
   * POST /loan/:loanId/repay
   * Submit a repayment (full or partial) against an active loan.
   */
  @Post(':loanId/repay')
  repay(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: RepayLoanDto,
    @Req() req: Request & { user: { ccuuid: string } },
  ) {
    return this.loanService.repayLoan(req.user.ccuuid, loanId, dto);
  }
}
