import { Controller, Get } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { OrgCodeError, parseOrgCode } from '../domain/org-code.js';
import { db } from '../lib/db.js';

@Controller('api/context')
export class ContextController {
  constructor(private readonly currentUsers: CurrentUserService) {}

  @Get()
  async getContext() {
    const [users, scopes] = await Promise.all([
      this.currentUsers.listDemoUsers(),
      db.orgScope.findMany({
        orderBy: [{ orgCode: 'asc' }, { unit: 'asc' }, { anaf: 'asc' }, { mador: 'asc' }, { team: 'asc' }],
      }),
    ]);

    return {
      authMode: 'demo-user-selector',
      users,
      scopes: scopes.map((scope) => {
        try {
          return {
            ...scope,
            ...(scope.orgCode ? parseOrgCode(scope.orgCode) : {}),
          };
        } catch (error) {
          if (error instanceof OrgCodeError) return scope;
          throw error;
        }
      }),
    };
  }
}
