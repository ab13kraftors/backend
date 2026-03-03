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
import { CreateAliasDto } from './entities/dto/create-alias.dto';
import { UpdateAliasDto } from './entities/dto/update-create.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/cas/v2/customer')
export class AliasController {
  constructor(private readonly aliasService: AliasService) {}

  @Post(':ccuuid/aliases')
  create(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Body() dto: CreateAliasDto,
  ) {
    return this.aliasService.create(participantId, ccuuid, dto);
  }

  @Get(':ccuuid/aliases')
  findAll(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
  ) {
    return this.aliasService.findAll(participantId, ccuuid);
  }

  @Put(':ccuuid/aliases/:aliasUuid')
  update(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Param('aliasUuid') aliasUuid: string,
    @Body() dto: UpdateAliasDto,
  ) {
    return this.aliasService.update(participantId, ccuuid, aliasUuid, dto);
  }

  @Delete(':ccuuid/aliases/:aliasUuid')
  remove(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Param('aliasUuid') aliasUuid: string,
  ) {
    return this.aliasService.remove(participantId, ccuuid, aliasUuid);
  }
}
