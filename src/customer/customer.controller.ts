import {
  Controller,
  Post,
  Body,
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
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SetPinDto, ChangePinDto, VerifyPinDto } from './dto/pin.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/fp/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.create(dto, participantId);
  }

  @Get(':customerId')
  async getCustomer(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.findOne(customerId, participantId);
  }

  @Get()
  async getAll(@Participant() participantId: string): Promise<Customer[]> {
    return this.customerService.findAll(participantId);
  }

  @Put(':customerId')
  async updateCustomer(
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.update(customerId, dto, participantId);
  }

  @Delete(':customerId')
  async deleteCustomer(
    @Param('customerId') customerId: string,
    @Participant() participantId: string,
  ): Promise<void> {
    return this.customerService.remove(customerId, participantId);
  }

  @Post(':customerId/set-pin')
  setPin(
    @Param('customerId') customerId: string,
    @Body() dto: SetPinDto,
    @Participant() participantId: string,
  ) {
    return this.customerService.setPin(customerId, participantId, dto);
  }

  @Put(':customerId/change-pin')
  changePin(
    @Param('customerId') customerId: string,
    @Body() dto: ChangePinDto,
    @Participant() participantId: string,
  ) {
    return this.customerService.changePin(customerId, participantId, dto);
  }

  @Post(':customerId/verify-pin')
  verifyPin(
    @Param('customerId') customerId: string,
    @Body() dto: VerifyPinDto,
    @Participant() participantId: string,
  ) {
    return this.customerService.verifyPin(customerId, participantId, dto.pin);
  }
}