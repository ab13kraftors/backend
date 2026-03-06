import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkService } from './bulk.service';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';

@UseGuards(JwtAuthGuard, ParticipantGuard)
@Controller('/api/switch/v1/payments/bulk')
export class BulkController {
  constructor(private readonly bulkService: BulkService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: BulkUploadDto,
    @Req() req: any, // ← real participantId from JWT
  ) {
    const participantId: string = req.participantId;
    return this.bulkService.processCSV(
      participantId,
      dto.debtorBic,
      dto.debtorAccount,
      dto.currency,
      file,
    );
  }

  @Get()
  findAll(@Req() req: any) {
    return this.bulkService.findAll(req.participantId);
  }

  @Get(':bulkId')
  findOne(@Param('bulkId') id: string) {
    return this.bulkService.findOne(id);
  }
}
