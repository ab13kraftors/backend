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
import { CreateFinAddressDto } from './dto/create-finaddress.dto';
import { AliasType } from 'src/common/enums/alias.enums';
import { SetDefaultFinAddressDto } from './dto/set-default-finaddress.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/cas/v2')
export class FinaddressController {
  constructor(private readonly finService: FinaddressService) {}

  @Get('finaddresses')
  resolveAlias(
    @Query('aliasType') aliasType: AliasType,
    @Query('aliasValue') aliasValue: string,
  ) {
    return this.finService.resolveAlias(aliasType, aliasValue);
  }

  @Post('customer/:customerId/finaddresses')
  create(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body() dto: CreateFinAddressDto,
  ) {
    return this.finService.create(participantId, customerId, dto);
  }

  @Get('customer/:customerId/finaddresses')
  findAll(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Query('pageNo') pageNo?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.finService.findAll(
      participantId,
      customerId,
      Number(pageNo ?? 0),
      Number(pageSize ?? 10),
    );
  }

  @Post('customer/:customerId/finaddresses/default')
  setDefault(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Body() dto: SetDefaultFinAddressDto,
  ) {
    return this.finService.setDefault(
      participantId,
      customerId,
      finAddressId,
    );
  }

  @Delete('customer/:customerId/finaddresses/:finAddressId')
  remove(
    @Participant() participantId: string,
    @Param('customerId') customerId: string,
    @Param('finAddressId') finAddressId: string,
  ) {
    return this.finService.remove(
      participantId,
      customerId,
      finAddressId,
    );
  }
}