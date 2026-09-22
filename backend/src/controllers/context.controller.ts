import { Controller, Get, Headers } from '@nestjs/common';
import { CurrentUserService } from '../auth/current-user.service.js';
import { OrgCodeError, parseOrgCode } from '../domain/org-code.js';
import { canAccessOrgScope } from '../domain/permissions.js';
import { db } from '../lib/db.js';

@Controller('api/context')
export class ContextController {
  constructor(private readonly currentUsers: CurrentUserService) {}

  @Get()
  async getContext(@Headers('x-user-id') userId: string | undefined) {
    const user = await this.currentUsers.require(userId);
    const scopes = await db.orgScope.findMany({
      orderBy: [{ orgCode: 'asc' }, { unit: 'asc' }, { anaf: 'asc' }, { mador: 'asc' }, { team: 'asc' }],
    });

    return {
      user,
      scopes: scopes.filter((scope) =>
        canAccessOrgScope(user.access, scope.mador, scope.orgCode),
      ).map((scope) => {
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
