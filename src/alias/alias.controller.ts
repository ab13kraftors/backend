import {
  Body,
  Controller,
  Post,
  Param,
  Get,
  Delete,
  Put,
} from '@nestjs/common';
import { AliasService } from './alias.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { CreateAliasDto } from './entities/dto/create-alias.dto';
import { UpdateAliasDto } from './entities/dto/update-create.dto';

@Controller('alias')
export class AliasController {
  constructor(private readonly aliasService: AliasService) {}

  @Post(':uuid/aliases')
  create(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Body() dto: CreateAliasDto,
  ) {
    return this.aliasService.create(participantId, ccuuid, dto);
  }

  @Get(':uuid/aliases')
  findAll(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
  ) {
    return this.aliasService.findAll(participantId, ccuuid);
  }

  @Put(':uuid/aliases/:aliasUuid')
  update(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Param('aliasUuid') aliasUuid: string,
    @Body() dto: UpdateAliasDto,
  ) {
    return this.aliasService.update(participantId, ccuuid, aliasUuid, dto);
  }

  @Delete(':uuid/aliases/:aliasUuid')
  remove(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Param('aliasUuid') aliasUuid: string,
  ) {
    return this.aliasService.remove(participantId, ccuuid, aliasUuid);
  }
}
