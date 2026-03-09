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
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { OneStepRegistrationDto } from './dto/one-step-registration.dto';
import { SetPinDto, ChangePinDto } from './dto/pin.dto';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
@UseGuards(JwtAuthGuard)
@Controller('api/fp/cas/v2/customer')
export class CustomerController {
  constructor(
    // Inject Customer service
    private readonly customerService: CustomerService,
  ) {}

  // ================== createCustomer ==================
  // Creates a new customer
  @Post()
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.create(dto, participantId);
  }

  // ================== getCustomer ==================
  // Fetch a specific customer by UUID
  @Get(':uuid')
  async getCustomer(
    @Param('uuid') uuid: string,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.findOne(uuid, participantId);
  }

  // ================== getAll ==================
  // Fetch all customers for the participant
  @Get()
  async getAll(@Participant() participantId: string): Promise<Customer[]> {
    return this.customerService.findAll(participantId);
  }

  // ================== updateCustomer ==================
  // Updates customer information
  @Put(':uuid')
  async updateCustomer(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateCustomerDto,
    @Participant() participantId: string,
  ): Promise<Customer> {
    return this.customerService.update(uuid, dto, participantId);
  }

  // ================== deleteCustomer ==================
  // Deletes a customer record
  @Delete(':uuid')
  async deleteCustomer(
    @Param('uuid') uuid: string,
    @Participant() participantId: string,
  ): Promise<void> {
    return this.customerService.remove(uuid, participantId);
  }

  // ================== oneStep ==================
  // Performs one-step customer registration (customer + alias + fin + wallet)
  @Post('one-step')
  async oneStep(
    @Participant() participantId: string,
    @Body() dto: OneStepRegistrationDto,
  ) {
    return this.customerService.oneStep(participantId, dto);
  }

  // ================== setPin ==================
  // Sets transaction PIN for customer
  @Post(':uuid/set-pin')
  setPin(
    @Param('uuid') uuid: string,
    @Body() dto: SetPinDto,
    @Participant() participantId: string,
  ) {
    return this.customerService.setPin(uuid, participantId, dto);
  }

  // ================== changePin ==================
  // Changes existing customer PIN
  @Put(':uuid/change-pin')
  changePin(
    @Param('uuid') uuid: string,
    @Body() dto: ChangePinDto,
    @Participant() participantId: string,
  ) {
    return this.customerService.changePin(uuid, participantId, dto);
  }
}
