import { Controller, Get, Headers, Query } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { parseOrThrow } from '../common/validation.js';
import { destinationSearchSchema } from '../domain/destination.js';
import { DestinationService } from '../services/destination.service.js';

@Controller('api/destinations')
export class DestinationController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly destinations: DestinationService,
  ) {}

  @Get()
  async search(
    @Headers('x-user-id') userId: string | undefined,
    @Query('orgScopeId') orgScopeId: string,
    @Query('search') search?: string,
    @Query('sourceRoomId') sourceRoomId?: string,
  ) {
    const user = await this.users.require(userId);
    const input = parseOrThrow(destinationSearchSchema, {
      orgScopeId,
      search,
      sourceRoomId,
    });
    return this.destinations.search(
      user,
      input.orgScopeId,
      input.search,
      input.sourceRoomId,
    );
  }
}
