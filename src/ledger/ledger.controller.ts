import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { LedgerService } from './ledger.service';
import { PostLedgerDto } from './dto/ledger-post.dto';
import { ReverseLedgerDto } from './dto/ledger-reverse.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParticipantGuard } from '../common/guards/participant/participant.guard';
import { Participant } from '../common/decorators/participant/participant.decorator';
import { Req, Res } from '@nestjs/common';

@Controller('api/ledger')
@UseGuards(JwtAuthGuard, ParticipantGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  async createTransfer(
    @Body() dto: PostLedgerDto,
    @Participant() participantId: string,
    @Req() req: Request & { user?: any },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (dto.participantId !== participantId) {
      return res.status(HttpStatus.FORBIDDEN).json({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'participantId in body must match authenticated participant',
      });
    }

    const result = await this.ledgerService.postTransfer({
      ...dto,
      postedBy: req.user?.participantId || 'system',
    });

    return res
      .status(
        result.status === 'already_processed'
          ? HttpStatus.OK
          : HttpStatus.CREATED,
      )
      .json({
        status: result.status,
        journalId: result.journalId,
        txId: result.txId,
        message:
          result.status === 'already_processed'
            ? 'Already processed'
            : 'Transfer posted successfully',
      });
  }

  @Get('journal/:txId')
  async getJournalByTxId(
    @Param('txId') txId: string,
    @Participant() participantId: string,
  ) {
    const journal = await this.ledgerService.findJournalByTxId(txId);

    if (!journal) {
      throw new NotFoundException(`Journal not found for txId: ${txId}`);
    }

    if (journal.participantId !== participantId && participantId !== 'SYSTEM') {
      throw new ForbiddenException(
        'You do not have permission to view this journal',
      );
    }

    return {
      journalId: journal.journalId,
      txId: journal.txId,
      reference: journal.reference,
      participantId: journal.participantId,
      postedBy: journal.postedBy,
      postedAt: journal.postedAt,
      postings: journal.postings.map((p) => ({
        accountId: p.accountId,
        amount: p.amount,
        side: p.side,
        memo: p.memo,
      })),
    };
  }

  @Post('reverse')
  @HttpCode(HttpStatus.CREATED)
  async reverseTransaction(
    @Body() dto: ReverseLedgerDto,
    @Participant() participantId: string,
    @Req() req: Request & { user?: any },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.ledgerService.reverseTransfer({
      originalTxId: dto.originalTxId,
      reason: dto.reason,
      participantId,
      postedBy: req.user?.participantId || 'system',
    });

    return res
      .status(
        result.status === 'already_processed'
          ? HttpStatus.OK
          : HttpStatus.CREATED,
      )
      .json({
        status: result.status,
        journalId: result.journalId,
        txId: result.txId,
        message:
          result.status === 'already_processed'
            ? 'Reversal already processed'
            : 'Reversal posted successfully',
      });
  }
}
