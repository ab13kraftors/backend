import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkService } from './bulk.service';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('/api/switch/v1/payments/bulk')
export class BulkController {
  constructor(
    // Inject Bulk service
    private readonly bulkService: BulkService,
  ) {}

  // ================== upload ==================
  // Uploads CSV file and processes bulk payments
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: BulkUploadDto,
    @Participant() participantId: string,
  ) {
    return this.bulkService.processCSV(
      participantId,
      dto.debtorBic,
      dto.debtorAccount,
      dto.currency,
      file,
    );
  }

  // ================== findAll ==================
  // Returns all bulk payment batches for participant
  @Get()
  findAll(@Participant() participantId: string) {
    return this.bulkService.findAll(participantId);
  }

  // ================== findOne ==================
  // Returns a specific bulk batch by ID
  @Get(':bulkId')
  findOne(@Param('bulkId') id: string) {
    return this.bulkService.findOne(id);
  }
}
