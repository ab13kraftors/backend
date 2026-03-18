import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Participant } from 'src/common/decorators/participant/participant.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { CustomerService } from 'src/customer/customer.service';
import { CustomerStatus } from 'src/common/enums/customer.enums';

@Controller('/api/admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  findAll(@Participant() participantId: string) {
    return this.customerService.findAll(participantId);
  }

  @Get(':customerId')
  findOne(
    @Param('customerId') id: string,
    @Participant() participantId: string,
  ) {
    return this.customerService.findOne(id, participantId);
  }

  @Patch(':customerId/block')
  async block(
    @Param('customerId') id: string,
    @Participant() participantId: string,
  ) {
    const customer = await this.customerService.findOne(id, participantId);
    customer.status = CustomerStatus.BLOCKED;
    return this.customerService.updateStatus(customer);
  }

  @Patch(':customerId/unblock')
  async unblock(
    @Param('customerId') id: string,
    @Participant() participantId: string,
  ) {
    const customer = await this.customerService.findOne(id, participantId);
    customer.status = CustomerStatus.BLOCKED;
    return this.customerService.updateStatus(customer);
  }
}
