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
import { distributionSchema } from '../domain/operations.schemas.js';
import { DistributionService } from '../services/distribution.service.js';

@Controller('api/distribution')
export class DistributionController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly distribution: DistributionService,
  ) {}

  @Get('packing-units')
  async list(
    @Headers('x-user-id') userId: string | undefined,
    @Query('orgScopeId') orgScopeId?: string,
  ) {
    const user = await this.users.require(userId);
    return this.distribution.listArrived(
      user,
      orgScopeId ? parseOrThrow(uuidSchema, orgScopeId) : undefined,
    );
  }

  @Post(':packingUnitId')
  async distribute(
    @Headers('x-user-id') userId: string | undefined,
    @Param('packingUnitId') packingUnitId: string,
    @Body() body: unknown,
  ) {
    const user = await this.users.require(userId);
    return this.distribution.distribute(
      user,
      parseOrThrow(uuidSchema, packingUnitId),
      parseOrThrow(distributionSchema, body),
    );
  }
}
