import { Controller, Get } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { db } from '../lib/db.js';

@Controller('api/context')
export class ContextController {
  constructor(private readonly currentUsers: CurrentUserService) {}

  @Get()
  async getContext() {
    const [users, scopes] = await Promise.all([
      this.currentUsers.listDemoUsers(),
      db.orgScope.findMany({
        orderBy: [{ unit: 'asc' }, { anaf: 'asc' }, { mador: 'asc' }],
      }),
    ]);

    return {
      authMode: 'demo-user-selector',
      users,
      scopes,
    };
  }
}
