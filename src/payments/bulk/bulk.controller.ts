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
@Controller('/api/fp/payments/bulk')
export class BulkController {
  constructor(private readonly bulkService: BulkService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: BulkUploadDto,
    @Participant() participantId: string,
  ) {
    return this.bulkService.processCSV(participantId, dto, file);
  }

  @Get()
  findAll(@Participant() participantId: string) {
    return this.bulkService.findAll(participantId);
  }

  @Get(':bulkId')
  findOne(@Param('bulkId') id: string, @Participant() participantId: string) {
    return this.bulkService.findOne(participantId, id);
  }

  @Get(':bulkId/items')
  findItems(@Param('bulkId') id: string, @Participant() participantId: string) {
    return this.bulkService.findItems(participantId, id);
  }
}
