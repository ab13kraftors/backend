import {
  Controller,
  UseGuards,
  Param,
  Body,
  Post,
  Get,
  Query,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FinaddressService } from './finaddress.service';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { CreateFinAddressDto } from './entities/dto/create-finaddress.dto';
import { AliasType } from 'src/common/enums/alias.enums';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/cas/v2')
export class FinaddressController {
  constructor(
    // Inject Finaddress service
    private readonly finService: FinaddressService,
  ) {}

  // ================== resolveAlias ==================
  // Resolves alias to financial address
  @Get('finaddresses')
  resolveAlias(
    @Query('aliasType') aliasType: AliasType,
    @Query('aliasValue') aliasValue: string,
  ) {
    return this.finService.resolveAlias(aliasType, aliasValue);
  }

  // ================== create ==================
  // Creates a financial address for a customer
  @Post('customer/:ccuuid/finaddresses')
  create(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Body() dto: CreateFinAddressDto,
  ) {
    return this.finService.create(participantId, ccuuid, dto);
  }

  // ================== findAll ==================
  // Returns paginated financial addresses for a customer
  @Get('customer/:ccuuid/finaddresses')
  findAll(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Query('pageNo') pageNo?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.finService.findAll(participantId, ccuuid, pageNo, pageSize);
  }

  // ================== setDefault ==================
  // Sets a financial address as default
  @Post('customer/:ccuuid/finaddresses/default')
  setDefault(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Body('finUuid') finUuid: string,
  ) {
    return this.finService.setDefault(participantId, ccuuid, finUuid);
  }

  // ================== remove ==================
  // Deletes a financial address
  @Delete('customer/:ccuuid/finaddresses/:finUuid')
  remove(
    @Participant() participantId: string,
    @Param('ccuuid') ccuuid: string,
    @Param('finUuid') finUuid: string,
  ) {
    return this.finService.remove(participantId, ccuuid, finUuid);
  }
}
