import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { parseOrThrow } from '../common/validation.js';
import { createShipmentSchema } from '../domain/operations.schemas.js';
import { ShipmentService } from '../services/shipment.service.js';

@Controller('api/shipments')
export class ShipmentController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly shipments: ShipmentService,
  ) {}

  @Post()
  async createAndLoad(
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.users.require(userId);
    return this.shipments.createAndLoad(
      user,
      parseOrThrow(createShipmentSchema, body),
    );
  }
}
