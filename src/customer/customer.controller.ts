import {
  Controller,
  Post,
  Body,
  Headers,
  Get,
  Param,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { Customer } from './entities/customer.entity';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { ParticipantGuard } from 'src/common/guards/participant/participant.guard';

@UseGuards(ParticipantGuard)
@Controller('api/fp/cas/v2/customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.create(dto, participantId);
  }

  @Get(':uuid')
  async getCustomer(
    @Param('uuid') uuid: string,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.findOne(uuid, participantId);
  }

  @Put(':uuid')
  async updateCustomer(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateCustomerDto,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.update(uuid, dto, participantId);
  }

  @Delete(':uuid')
  async deleteCustomer(
    @Param('uuid') uuid: string,
    @Participant() participantId: string,
  ): Promise<void> {
    return this.customerService.remove(uuid, participantId);
  }
}
