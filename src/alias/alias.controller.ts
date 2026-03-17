import {
  Body,
  Controller,
  Post,
  Param,
  Get,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AliasService } from './alias.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { CreateAliasDto } from './dto/create-alias.dto';
import { UpdateAliasDto } from './dto/update-create.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/customers')
export class AliasController {
  constructor(private readonly aliasService: AliasService) {}

  @Post(':customerId/aliases')
  create(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body() dto: CreateAliasDto,
  ) {
    return this.aliasService.create(participantId, customerId, dto);
  }

  @Get(':customerId/aliases')
  findAll(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.aliasService.findAll(participantId, customerId);
  }

  @Put(':customerId/aliases/:aliasId')
  update(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Param('aliasId') aliasId: string,
    @Body() dto: UpdateAliasDto,
  ) {
    return this.aliasService.update(aliasId, participantId, dto);
  }

  @Delete(':customerId/aliases/:aliasId')
  remove(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Param('aliasId') aliasId: string,
  ) {
    return this.aliasService.remove(aliasId, participantId);
  }
}