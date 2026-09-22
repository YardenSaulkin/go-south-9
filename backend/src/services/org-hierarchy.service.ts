import { BadRequestException, Injectable } from '@nestjs/common';
import { OrgHierarchyLevel, Prisma } from '@prisma/client';
import { db } from '../lib/db.js';

@Injectable()
export class OrgHierarchyService {
  // Returns the 2-digit code for this (level, textValue), creating it if needed.
  // Uses a serializable transaction to safely assign the next serial code.
  async getOrCreateCode(level: OrgHierarchyLevel, textValue: string): Promise<string> {
    return db.$transaction(
      async (tx) => {
        const existing = await tx.orgHierarchyMapping.findFirst({
          where: { level, textValue },
        });
        if (existing) return existing.code;

        const maxEntry = await tx.orgHierarchyMapping.findFirst({
          where: { level },
          orderBy: { code: 'desc' },
        });
        const next = maxEntry ? parseInt(maxEntry.code, 10) + 1 : 1;
        if (next > 99) {
          throw new BadRequestException(`org hierarchy level '${level}' is full (max 99 entries)`);
        }
        const code = String(next).padStart(2, '0');

        const created = await tx.orgHierarchyMapping.create({
          data: { level, textValue, code },
        });
        return created.code;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async computeOrgCode(
    unit: string,
    anaf: string,
    mador: string,
    team: string,
  ): Promise<string> {
    const [u, a, m, t] = await Promise.all([
      this.getOrCreateCode(OrgHierarchyLevel.unit, unit),
      this.getOrCreateCode(OrgHierarchyLevel.anaf, anaf),
      this.getOrCreateCode(OrgHierarchyLevel.mador, mador),
      this.getOrCreateCode(OrgHierarchyLevel.team, team),
    ]);
    return `${u}${a}${m}${t}`;
  }

  async resolveOrgCode(
    orgCode: string,
  ): Promise<{ unit: string; anaf: string; mador: string; team: string } | null> {
    if (orgCode.length !== 8) return null;

    const [unit, anaf, mador, team] = await Promise.all([
      db.orgHierarchyMapping.findFirst({
        where: { level: OrgHierarchyLevel.unit, code: orgCode.substring(0, 2) },
      }),
      db.orgHierarchyMapping.findFirst({
        where: { level: OrgHierarchyLevel.anaf, code: orgCode.substring(2, 4) },
      }),
      db.orgHierarchyMapping.findFirst({
        where: { level: OrgHierarchyLevel.mador, code: orgCode.substring(4, 6) },
      }),
      db.orgHierarchyMapping.findFirst({
        where: { level: OrgHierarchyLevel.team, code: orgCode.substring(6, 8) },
      }),
    ]);

    return {
      unit: unit?.textValue ?? orgCode.substring(0, 2),
      anaf: anaf?.textValue ?? orgCode.substring(2, 4),
      mador: mador?.textValue ?? orgCode.substring(4, 6),
      team: team?.textValue ?? orgCode.substring(6, 8),
    };
  }

  listAll() {
    return db.orgHierarchyMapping.findMany({
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });
  }
}
