import { Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentUser } from '../auth/current-user.service.js';
import { assertCanAccessOrgScope } from '../domain/permissions.js';
import { db } from '../lib/db.js';

@Injectable()
export class DestinationService {
  async search(user: CurrentUser, orgScopeId: string, search: string) {
    const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
    if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
    assertCanAccessOrgScope(user.access, scope.mador, scope.orgCode);

    const normalizedSearch = search.trim();
    return db.destination.findMany({
      where: {
        orgScopeId: scope.id,
        ...(normalizedSearch
          ? {
              OR: [
                {
                  destinationCode: {
                    contains: normalizedSearch,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  description: {
                    contains: normalizedSearch,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      take: 20,
      orderBy: { destinationCode: 'asc' },
    });
  }
}
