import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUserService } from '../auth/current-user.service.js';
import { PocService } from '../services/poc.service.js';

@Controller('api/poc')
export class PocController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly poc: PocService,
  ) {}

  private async requirePoc(headerValue: string | undefined) {
    const user = await this.users.require(headerValue);
    if (user.role !== UserRole.poc && user.role !== UserRole.admin) {
      throw new ForbiddenException('גישה מותרת לקצין קישור בלבד');
    }
    return user;
  }

  @Get('dashboard')
  async getDashboard(@Headers('x-user-id') userId: string | undefined) {
    const user = await this.requirePoc(userId);
    return this.poc.getUnitDashboard(user);
  }

  @Post('shipments/:id/verify')
  async verifyShipment(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') shipmentId: string,
  ) {
    const user = await this.requirePoc(userId);
    return this.poc.verifyShipment(user, shipmentId);
  }
}
