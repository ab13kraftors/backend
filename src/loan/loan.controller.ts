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

  @Post('apply')
  apply(
    @Participant() participantId: string,
    @Body() dto: ApplyLoanDto,
    @Req() req: Request & { user: { customerId: string } },
  ) {
    return this.loanService.applyLoan(req.user.customerId, participantId, dto);
  }

  @Get()
  getMyLoans(@Req() req: Request & { user: { customerId: string } }) {
    return this.loanService.getLoansByCustomer(req.user.customerId);
  }

  @Get(':loanId')
  getLoan(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { customerId: string } },
  ) {
    return this.loanService.getLoanById(loanId, req.user.customerId);
  }

  @Get(':loanId/repayments')
  getRepayments(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Req() req: Request & { user: { customerId: string } },
  ) {
    return this.loanService.getRepaymentHistory(loanId, req.user.customerId);
  }

  @Post(':loanId/repay')
  repay(
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: RepayLoanDto,
    @Req() req: Request & { user: { customerId: string } },
  ) {
    return this.loanService.repayLoan(req.user.customerId, loanId, dto);
  }
}
