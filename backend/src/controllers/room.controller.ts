import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { parseOrThrow, uuidSchema } from '../common/validation.js';
import {
  createReservationSchema,
  roomAvailabilitySchema,
  roomSearchSchema,
} from '../domain/facility.schemas.js';
import { RoomService } from '../services/room.service.js';

@Controller('api/facility/rooms')
export class RoomController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly rooms: RoomService,
  ) {}

  @Get()
  async search(
    @Headers('x-user-id') userId: string | undefined,
    @Query() query: unknown,
  ) {
    await this.users.require(userId);
    return this.rooms.search(parseOrThrow(roomSearchSchema, query));
  }

  @Get('reservations/mine')
  async myReservations(@Headers('x-user-id') userId: string | undefined) {
    const user = await this.users.require(userId);
    return this.rooms.listMyReservations(user);
  }

  @Get(':id')
  async getRoom(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    await this.users.require(userId);
    return this.rooms.getWithAvailability(
      parseOrThrow(uuidSchema, id),
      parseOrThrow(roomAvailabilitySchema, query),
    );
  }

  @Post(':id/reservations')
  async reserve(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const user = await this.users.require(userId);
    return this.rooms.reserve(
      user,
      parseOrThrow(uuidSchema, id),
      parseOrThrow(createReservationSchema, body),
    );
  }
}
