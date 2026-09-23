import { Controller, Get, Headers } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { StatusService } from '../services/status.service.js';

@Controller('api/status')
export class StatusController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly status: StatusService,
  ) {}

  @Get('shipments')
  async getShipments(@Headers('x-user-id') userId: string | undefined) {
    const user = await this.users.require(userId);
    return this.status.getShipmentsStatus(user);
  }

  @Get('packing-units')
  async getPackingUnits(@Headers('x-user-id') userId: string | undefined) {
    const user = await this.users.require(userId);
    return this.status.getPackingUnitsStatus(user);
  }
}
