import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { parseOrThrow, uuidSchema } from '../common/validation.js';
import { createPackingUnitSchema } from '../domain/operations.schemas.js';
import { PackingService } from '../services/packing.service.js';

@Controller('api/packing-units')
export class PackingController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly packing: PackingService,
  ) {}

  @Get('eligible-items')
  async eligibleItems(
    @Headers('x-user-id') userId: string | undefined,
    @Query('orgScopeId') orgScopeId: string,
    @Query('sourceRoomId') sourceRoomId?: string,
  ) {
    const user = await this.users.require(userId);
    return this.packing.listEligibleItems(
      user,
      parseOrThrow(uuidSchema, orgScopeId),
      sourceRoomId,
    );
  }

  @Get('source-rooms')
  async sourceRooms(
    @Headers('x-user-id') userId: string | undefined,
    @Query('orgScopeId') orgScopeId: string,
  ) {
    const user = await this.users.require(userId);
    return this.packing.listSourceRooms(
      user,
      parseOrThrow(uuidSchema, orgScopeId),
    );
  }

  @Get('mapping-status')
  async mappingStatus(
    @Headers('x-user-id') userId: string | undefined,
    @Query('orgScopeId') orgScopeId: string,
    @Query('sourceRoomId') sourceRoomId?: string,
  ) {
    const user = await this.users.require(userId);
    return this.packing.getMappingStatus(
      user,
      parseOrThrow(uuidSchema, orgScopeId),
      sourceRoomId,
    );
  }

  @Get('eligible-for-shipment')
  async eligibleForShipment(
    @Headers('x-user-id') userId: string | undefined,
    @Query('orgScopeId') orgScopeId: string,
  ) {
    const user = await this.users.require(userId);
    return this.packing.listEligiblePackingUnits(
      user,
      parseOrThrow(uuidSchema, orgScopeId),
    );
  }

  @Post()
  async create(
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: unknown,
  ) {
    const user = await this.users.require(userId);
    return this.packing.create(
      user,
      parseOrThrow(createPackingUnitSchema, body),
    );
  }
}
