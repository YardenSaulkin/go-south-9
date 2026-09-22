import { Controller, Get, Headers } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { DashboardService } from '../services/dashboard.service.js';

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly dashboard: DashboardService,
  ) {}

  @Get()
  async get(@Headers('x-user-id') userId: string | undefined) {
    const user = await this.users.require(userId);
    return this.dashboard.get(user);
  }
}
