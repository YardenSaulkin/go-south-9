import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.service.js';
import { normalizeDestinationId } from '../domain/destination.js';
import { assertCanAccessOrgScope } from '../domain/permissions.js';
import { db } from '../lib/db.js';

interface PersistedDestinationRow {
  destinationRoomId: string | null;
  destinationDescription: string | null;
  sourceRoomId?: string | null;
}

export interface DestinationCatalogEntry {
  id: string;
  description: string;
  hasHistoricalDescriptionCollision?: boolean;
}

interface DescriptionCandidate {
  display: string;
  precedence: number;
}

function withHebrewPrefix(
  value: unknown,
  prefix: string,
  alreadyPrefixed: RegExp,
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return alreadyPrefixed.test(trimmed) ? trimmed : `${prefix} ${trimmed}`;
}

function descriptionCandidate(value: string): DescriptionCandidate | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const snapshot = parsed as Record<string, unknown>;
    const building = withHebrewPrefix(
      snapshot.building,
      'בניין',
      /^(?:בניין|מבנה)(?:\s|$)/u,
    );
    const floor = withHebrewPrefix(
      snapshot.floor,
      'קומה',
      /^(?:קומה|קומת)(?:\s|$)/u,
    );
    const room = withHebrewPrefix(
      snapshot.room ?? snapshot.roomId,
      'חדר',
      /^(?:חדר|לשכה|מחסן|אולם)(?:\s|$)/u,
    );
    const display = [building, floor, room].filter(Boolean).join(', ');
    return display ? { display, precedence: 1 } : null;
  } catch {
    const trimmed = value.trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return null;
    return {
      display: value,
      precedence: 0,
    };
  }
}

function destinationWhere(orgScopeId: string | undefined) {
  return {
    ...(orgScopeId ? { orgScopeId } : {}),
    destinationRoomId: { not: null },
  };
}

export function normalizeDestinationRows(
  rows: PersistedDestinationRow[],
  sourceRoomId?: string,
): DestinationCatalogEntry[] {
  const entries = new Map<
    string,
    {
      ids: Set<string>;
      rawDescriptions: Set<string>;
      candidates: DescriptionCandidate[];
      sourceRoomIds: Set<string>;
    }
  >();

  for (const row of rows) {
    const id = row.destinationRoomId?.trim();
    const description = row.destinationDescription?.trim();
    if (!id || !description) continue;
    const normalizedId = normalizeDestinationId(id);
    const current = entries.get(normalizedId) ?? {
      ids: new Set<string>(),
      rawDescriptions: new Set<string>(),
      candidates: [],
      sourceRoomIds: new Set<string>(),
    };
    current.ids.add(id);
    current.rawDescriptions.add(description);
    const candidate = descriptionCandidate(description);
    if (candidate) current.candidates.push(candidate);
    const persistedSourceRoomId = row.sourceRoomId?.trim();
    if (persistedSourceRoomId) {
      current.sourceRoomIds.add(persistedSourceRoomId);
    }
    entries.set(normalizedId, current);
  }

  const preferredSourceRoomId = sourceRoomId?.trim();
  return [...entries.entries()]
    .filter(([, value]) => value.candidates.length > 0)
    .sort(([leftId, left], [rightId, right]) => {
      if (preferredSourceRoomId) {
        const leftMatch = left.sourceRoomIds.has(preferredSourceRoomId);
        const rightMatch = right.sourceRoomIds.has(preferredSourceRoomId);
        if (leftMatch !== rightMatch) return leftMatch ? -1 : 1;
      }
      return leftId.localeCompare(rightId);
    })
    .map(([normalizedId, value]) => {
      const ids = [...value.ids].sort((left, right) => left.localeCompare(right));
      const descriptions = [...value.candidates].sort(
        (left, right) =>
          left.precedence - right.precedence ||
          left.display.localeCompare(right.display),
      );
      return {
        id: ids[0] ?? normalizedId,
        description: descriptions[0]?.display ?? '',
        ...(value.rawDescriptions.size > 1
          ? { hasHistoricalDescriptionCollision: true }
          : {}),
      };
    });
}

export async function loadDestinationCatalog(
  client: Prisma.TransactionClient,
  orgScopeId: string | undefined,
  search = '',
  sourceRoomId?: string,
): Promise<DestinationCatalogEntry[]> {
  const normalizedSearch = search.trim();
  const where = destinationWhere(orgScopeId);
  const select = {
    destinationRoomId: true,
    destinationDescription: true,
    sourceRoomId: true,
  } as const;
  const [items, packingUnits, shipments] = await Promise.all([
    client.item.findMany({ where, select }),
    client.packingUnit.findMany({ where, select }),
    client.shipment.findMany({ where, select }),
  ]);

  const normalizedQuery = normalizeDestinationId(normalizedSearch);
  const rows = [...items, ...packingUnits, ...shipments];
  const matchingIds = new Set(
    rows
      .filter((row) => {
        if (!normalizedQuery) return true;
        const id = row.destinationRoomId?.trim();
        const rawDescription = row.destinationDescription?.trim();
        const normalizedDescription = rawDescription
          ? descriptionCandidate(rawDescription)?.display
          : null;
        return Boolean(
          (id && normalizeDestinationId(id).includes(normalizedQuery)) ||
            rawDescription?.toLocaleLowerCase().includes(normalizedQuery) ||
            normalizedDescription
              ?.toLocaleLowerCase()
              .includes(normalizedQuery),
        );
      })
      .map((row) => normalizeDestinationId(row.destinationRoomId ?? ''))
      .filter(Boolean),
  );
  return normalizeDestinationRows(
    rows,
    sourceRoomId,
  )
    .filter(
      (entry) =>
        !normalizedQuery ||
        matchingIds.has(normalizeDestinationId(entry.id)),
    )
    .slice(0, 20);
}

export async function findPersistedDestinationById(
  client: Prisma.TransactionClient,
  orgScopeId: string | undefined,
  destinationId: string,
): Promise<DestinationCatalogEntry | null> {
  const search = destinationId.trim();
  const where = {
    ...(orgScopeId ? { orgScopeId } : {}),
    destinationRoomId: {
      contains: search,
      mode: Prisma.QueryMode.insensitive,
    },
  };
  const select = {
    destinationRoomId: true,
    destinationDescription: true,
    sourceRoomId: true,
  } as const;
  const [items, packingUnits, shipments] = await Promise.all([
    client.item.findMany({ where, select }),
    client.packingUnit.findMany({ where, select }),
    client.shipment.findMany({ where, select }),
  ]);
  const normalizedId = normalizeDestinationId(destinationId);
  const exactRows = [...items, ...packingUnits, ...shipments].filter(
    (row) =>
      row.destinationRoomId &&
      normalizeDestinationId(row.destinationRoomId) === normalizedId,
  );
  if (exactRows.length === 0) return null;

  const catalogEntry = normalizeDestinationRows(exactRows)[0];
  if (catalogEntry) return catalogEntry;

  const persistedIds = exactRows
    .map((row) => row.destinationRoomId?.trim())
    .filter((id): id is string => Boolean(id))
    .sort((left, right) => left.localeCompare(right));
  const id = persistedIds[0] ?? search;
  return { id, description: id };
}

@Injectable()
export class DestinationService {
  async search(
    user: CurrentUser,
    orgScopeId: string,
    search: string,
    sourceRoomId?: string,
  ) {
    const scope = await db.orgScope.findUnique({ where: { id: orgScopeId } });
    if (!scope) throw new NotFoundException('המסגרת הארגונית לא נמצאה');
    assertCanAccessOrgScope(user.access, scope.mador, scope.orgCode);

    return loadDestinationCatalog(db, scope.id, search, sourceRoomId);
  }
}
