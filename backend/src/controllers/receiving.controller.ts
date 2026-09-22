import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { parseOrThrow, uuidSchema } from '../common/validation.js';
import { receivingSchema } from '../domain/operations.schemas.js';
import { ReceivingService } from '../services/receiving.service.js';

@Controller('api/receiving')
export class ReceivingController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly receiving: ReceivingService,
  ) {}

  @Get('shipments')
  async list(
    @Headers('x-user-id') userId: string | undefined,
    @Query('orgScopeId') orgScopeId?: string,
  ) {
    const user = await this.users.require(userId);
    return this.receiving.listActive(
      user,
      orgScopeId ? parseOrThrow(uuidSchema, orgScopeId) : undefined,
    );
  }

  @Post(':shipmentId')
  async confirm(
    @Headers('x-user-id') userId: string | undefined,
    @Param('shipmentId') shipmentId: string,
    @Body() body: unknown,
  ) {
    const user = await this.users.require(userId);
    return this.receiving.confirm(
      user,
      parseOrThrow(uuidSchema, shipmentId),
      parseOrThrow(receivingSchema, body),
    );
  }
}
