# Role System Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-role system (super_user / logistics_user / regular_user) with ADMIN / POC / NORMAL, introduce an 8-digit org-code that replaces plain-text hierarchy storage on users, add an admin-only user-management page, and a POC monitoring + verification dashboard.

**Architecture:** The DB enum is renamed in-place; a new `org_hierarchy_mappings` table maps text values (unit/anaf/mador/team) to 2-digit serial codes that are concatenated into an 8-char `org_code` stored on both `users` and `org_scopes`. The `user_access_profiles` view is recreated with POC-specific `access_unit_code` and `canApproveShipments` fields. Frontend adds two guarded pages (`/admin/users`, `/poc/dashboard`) and shows a role chip in the main menu header.

**Tech Stack:** NestJS (backend), Prisma + PostgreSQL, React + MUI (RTL), Vitest, TypeScript.

**Spec:** See brainstorming conversation above (no spec file written).

## Global Constraints

- All Hebrew user-facing copy must be RTL (`dir="rtl"`), use `fontFamily: 'Heebo, sans-serif'`.
- Role enum DB values (lowercase): `admin`, `poc`, `normal`.
- Org code format: exactly 8 chars, e.g. `"01020304"` — unit(2) + anaf(2) + mador(2) + team(2).
- Backend auth is header-based (`x-user-id`). No JWT. No passwords.
- Backend base URL: `http://localhost:3000`. Frontend dev server: Vite default.
- One ADMIN exists in the system; they are seeded, not registered via signup.
- `OrgScope.mador` remains non-nullable and populated (text kept for backward-compat queries).

---

## Task 1: DB Migration — Rename Roles, Add Org Code System, Recreate View

**Files:**
- Create: `backend/prisma/migrations/20260922_role_system_revamp/migration.sql`
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces:
  - Prisma enum `UserRole` with values `admin | poc | normal`
  - New Prisma model `OrgHierarchyMapping`
  - `users.org_code char(8)` column
  - `org_scopes.org_code char(8)` column
  - Updated `user_access_profiles` view with `access_unit_code` and `can_approve_shipments` columns

- [ ] **Step 1: Create the migration SQL file**

Create `backend/prisma/migrations/20260922_role_system_revamp/migration.sql` with the content below.

```sql
-- 1. Rename UserRole enum values
ALTER TYPE user_role RENAME VALUE 'super_user' TO 'admin';
ALTER TYPE user_role RENAME VALUE 'logistics_user' TO 'poc';
ALTER TYPE user_role RENAME VALUE 'regular_user' TO 'normal';

-- 2. Org hierarchy level enum + mapping table
DO $$ BEGIN
  CREATE TYPE org_hierarchy_level AS ENUM ('unit', 'anaf', 'mador', 'team');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS org_hierarchy_mappings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level       org_hierarchy_level NOT NULL,
  text_value  text NOT NULL,
  code        char(2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level, text_value),
  UNIQUE (level, code)
);

-- 3. Add org_code columns
ALTER TABLE org_scopes ADD COLUMN IF NOT EXISTS org_code char(8);
ALTER TABLE users      ADD COLUMN IF NOT EXISTS org_code char(8);

-- 4. Migrate existing hierarchy text → serial codes
-- Units
WITH ranked AS (
  SELECT DISTINCT unit, LPAD(ROW_NUMBER() OVER (ORDER BY unit)::text, 2, '0') AS code
  FROM org_scopes WHERE unit IS NOT NULL
)
INSERT INTO org_hierarchy_mappings (level, text_value, code)
SELECT 'unit', unit, code FROM ranked ON CONFLICT DO NOTHING;

-- Anafs
WITH ranked AS (
  SELECT DISTINCT anaf, LPAD(ROW_NUMBER() OVER (ORDER BY anaf)::text, 2, '0') AS code
  FROM org_scopes WHERE anaf IS NOT NULL
)
INSERT INTO org_hierarchy_mappings (level, text_value, code)
SELECT 'anaf', anaf, code FROM ranked ON CONFLICT DO NOTHING;

-- Madors
WITH ranked AS (
  SELECT DISTINCT mador, LPAD(ROW_NUMBER() OVER (ORDER BY mador)::text, 2, '0') AS code
  FROM org_scopes WHERE mador IS NOT NULL
)
INSERT INTO org_hierarchy_mappings (level, text_value, code)
SELECT 'mador', mador, code FROM ranked ON CONFLICT DO NOTHING;

-- Teams
WITH ranked AS (
  SELECT DISTINCT team, LPAD(ROW_NUMBER() OVER (ORDER BY team)::text, 2, '0') AS code
  FROM org_scopes WHERE team IS NOT NULL
)
INSERT INTO org_hierarchy_mappings (level, text_value, code)
SELECT 'team', team, code FROM ranked ON CONFLICT DO NOTHING;

-- 5. Populate org_scopes.org_code from the mapping table
UPDATE org_scopes os
SET org_code = CONCAT(
  COALESCE((SELECT code FROM org_hierarchy_mappings WHERE level = 'unit'  AND text_value = os.unit),  '00'),
  COALESCE((SELECT code FROM org_hierarchy_mappings WHERE level = 'anaf'  AND text_value = os.anaf),  '00'),
  COALESCE((SELECT code FROM org_hierarchy_mappings WHERE level = 'mador' AND text_value = os.mador), '00'),
  COALESCE((SELECT code FROM org_hierarchy_mappings WHERE level = 'team'  AND text_value = os.team),  '00')
);

-- 6. Populate users.org_code from their org_scope
UPDATE users u
SET org_code = (SELECT org_code FROM org_scopes os WHERE os.id = u.org_scope_id)
WHERE u.org_scope_id IS NOT NULL;

-- 7. Drop plain-text hierarchy columns from users (kept on org_scopes for display)
ALTER TABLE users DROP COLUMN IF EXISTS unit;
ALTER TABLE users DROP COLUMN IF EXISTS anaf;
ALTER TABLE users DROP COLUMN IF EXISTS mador;
ALTER TABLE users DROP COLUMN IF EXISTS team;

-- 8. Recreate the user_access_profiles view with new role semantics and POC fields
DROP VIEW IF EXISTS user_access_profiles;

CREATE VIEW user_access_profiles AS
SELECT
  u.id                                                         AS user_id,
  u.role,
  -- Normal users get text-mador for existing mador-scoped queries
  CASE WHEN u.role = 'normal' THEN s.mador ELSE NULL END       AS access_mador,
  -- POC users get their unit code (first 2 chars of org_code)
  CASE WHEN u.role = 'poc' THEN LEFT(u.org_code, 2) ELSE NULL END AS access_unit_code,
  TRUE                                                          AS can_create_shipments,
  TRUE                                                          AS can_create_packing_units,
  TRUE                                                          AS can_view_shipments,
  TRUE                                                          AS can_view_packing_units,
  (u.role = 'admin')                                            AS can_view_global_shipments_dashboard,
  -- Only POC can mark shipments as verified
  (u.role IN ('poc', 'admin'))                                  AS can_approve_shipments,
  CASE
    WHEN u.role = 'admin' THEN NULL
    WHEN u.role = 'poc'   THEN LEFT(u.org_code, 2)
    ELSE s.mador
  END                                                           AS data_visibility_scope
FROM users u
LEFT JOIN org_scopes s ON s.id = u.org_scope_id;
```

- [ ] **Step 2: Update `backend/prisma/schema.prisma`**

Make the following changes (do not remove any unrelated models):

a) Replace the `UserRole` enum:
```prisma
enum UserRole {
  admin
  poc
  normal

  @@map("user_role")
}
```

b) Add the `OrgHierarchyLevel` enum and `OrgHierarchyMapping` model after the `OrgScopeLevel` enum:
```prisma
enum OrgHierarchyLevel {
  unit
  anaf
  mador
  team

  @@map("org_hierarchy_level")
}

model OrgHierarchyMapping {
  id        String            @id @default(uuid()) @db.Uuid
  level     OrgHierarchyLevel
  textValue String            @map("text_value")
  code      String            @db.Char(2)
  createdAt DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)

  @@unique([level, textValue])
  @@unique([level, code])
  @@map("org_hierarchy_mappings")
}
```

c) In the `User` model — remove `unit String?`, `anaf String?`, `mador String?`, `team String?` and add `orgCode String? @map("org_code") @db.Char(8)`.

d) In the `OrgScope` model — add `orgCode String? @map("org_code") @db.Char(8)` field.

e) In the `UserAccessProfile` view — add two new fields and update the `@@map`:
```prisma
view UserAccessProfile {
  userId                          String    @map("user_id") @db.Uuid
  role                            UserRole
  accessMador                     String?   @map("access_mador")
  accessUnitCode                  String?   @map("access_unit_code")
  canCreateShipments              Boolean   @map("can_create_shipments")
  canCreatePackingUnits           Boolean   @map("can_create_packing_units")
  canViewShipments                Boolean   @map("can_view_shipments")
  canViewPackingUnits             Boolean   @map("can_view_packing_units")
  canViewGlobalShipmentsDashboard Boolean   @map("can_view_global_shipments_dashboard")
  canApproveShipments             Boolean   @map("can_approve_shipments")
  dataVisibilityScope             String?   @map("data_visibility_scope")

  @@map("user_access_profiles")
}
```

- [ ] **Step 3: Run Prisma generate**

```bash
cd backend && npx prisma generate
```

Expected: no errors. The new `OrgHierarchyMapping` model appears in the generated client.

- [ ] **Step 4: Apply the migration to the DB**

```bash
cd backend && npx prisma db execute --file prisma/migrations/20260922_role_system_revamp/migration.sql --schema prisma/schema.prisma
```

If the DB is not reachable, note the migration as pending (same pattern as the existing "PENDING REVIEW" comment in the other migrations).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add role revamp migration — ADMIN/POC/NORMAL, org_code columns, new view fields"
```

---

## Task 2: OrgHierarchyService — Compute and Resolve Org Codes

**Files:**
- Create: `backend/src/services/org-hierarchy.service.ts`

**Interfaces:**
- Consumes: `@prisma/client` — `OrgHierarchyLevel`, `db`
- Produces:
  - `OrgHierarchyService.computeOrgCode(unit, anaf, mador, team): Promise<string>`
  - `OrgHierarchyService.resolveOrgCode(orgCode: string): Promise<{ unit: string; anaf: string; mador: string; team: string } | null>`
  - `OrgHierarchyService.listAll(): Promise<OrgHierarchyMapping[]>`

- [ ] **Step 1: Write the service**

Create `backend/src/services/org-hierarchy.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
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
```

- [ ] **Step 2: Write unit tests**

Create `backend/src/services/org-hierarchy.service.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrgHierarchyService } from './org-hierarchy.service.js';
import { OrgHierarchyLevel } from '@prisma/client';

// Mock the db module
vi.mock('../lib/db.js', () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    orgHierarchyMapping: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { db } from '../lib/db.js';
const mockDb = db as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  orgHierarchyMapping: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const mockTx = {
  orgHierarchyMapping: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

describe('OrgHierarchyService.getOrCreateCode', () => {
  let service: OrgHierarchyService;

  beforeEach(() => {
    service = new OrgHierarchyService();
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
  });

  it('returns existing code if present', async () => {
    mockTx.orgHierarchyMapping.findFirst.mockResolvedValueOnce({ code: '03' });
    const code = await service.getOrCreateCode(OrgHierarchyLevel.unit, 'חיל האוויר');
    expect(code).toBe('03');
    expect(mockTx.orgHierarchyMapping.create).not.toHaveBeenCalled();
  });

  it('creates code 01 when no entries exist for the level', async () => {
    mockTx.orgHierarchyMapping.findFirst
      .mockResolvedValueOnce(null)  // no existing entry
      .mockResolvedValueOnce(null); // no max entry
    mockTx.orgHierarchyMapping.create.mockResolvedValueOnce({ code: '01' });
    const code = await service.getOrCreateCode(OrgHierarchyLevel.unit, 'חיל האוויר');
    expect(code).toBe('01');
    expect(mockTx.orgHierarchyMapping.create).toHaveBeenCalledWith({
      data: { level: OrgHierarchyLevel.unit, textValue: 'חיל האוויר', code: '01' },
    });
  });

  it('increments from max code', async () => {
    mockTx.orgHierarchyMapping.findFirst
      .mockResolvedValueOnce(null)         // no existing entry
      .mockResolvedValueOnce({ code: '04' }); // max is 04
    mockTx.orgHierarchyMapping.create.mockResolvedValueOnce({ code: '05' });
    const code = await service.getOrCreateCode(OrgHierarchyLevel.unit, 'חיל הים');
    expect(code).toBe('05');
  });
});

describe('OrgHierarchyService.resolveOrgCode', () => {
  let service: OrgHierarchyService;

  beforeEach(() => {
    service = new OrgHierarchyService();
    vi.clearAllMocks();
  });

  it('returns null for invalid length', async () => {
    const result = await service.resolveOrgCode('123');
    expect(result).toBeNull();
  });

  it('resolves all four levels', async () => {
    mockDb.orgHierarchyMapping.findFirst
      .mockResolvedValueOnce({ textValue: 'חיל האוויר' })
      .mockResolvedValueOnce({ textValue: 'טייסת' })
      .mockResolvedValueOnce({ textValue: 'לוגיסטיקה' })
      .mockResolvedValueOnce({ textValue: 'צוות א' });

    const result = await service.resolveOrgCode('01020304');
    expect(result).toEqual({
      unit: 'חיל האוויר',
      anaf: 'טייסת',
      mador: 'לוגיסטיקה',
      team: 'צוות א',
    });
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd backend && npx vitest run src/services/org-hierarchy.service.spec.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/org-hierarchy.service.ts backend/src/services/org-hierarchy.service.spec.ts
git commit -m "feat: add OrgHierarchyService for computing and resolving 8-digit org codes"
```

---

## Task 3: Update Auth, Permissions, and Access Profile Types

**Files:**
- Modify: `backend/src/services/auth.service.ts`
- Modify: `backend/src/auth/current-user.service.ts`
- Modify: `backend/src/domain/permissions.ts`
- Modify: `backend/src/services/dashboard.service.ts`
- Modify: `backend/src/services/receiving.service.ts`

**Interfaces:**
- Consumes: `OrgHierarchyService.computeOrgCode` (from Task 2)
- Produces:
  - Updated `AccessProfile` interface with `accessUnitCode` and `canApproveShipments`
  - Updated `CurrentUser` interface (no `mador`, has `orgCode`)
  - `assertCanApproveShipment(access, orgScopeOrgCode)` function
  - Auth signup uses `OrgHierarchyService` to compute orgCode

- [ ] **Step 1: Update `backend/src/domain/permissions.ts`**

Replace the entire file:

```typescript
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface AccessProfile {
  role: UserRole;
  accessMador: string | null;
  accessUnitCode: string | null;
  canCreateShipments: boolean;
  canCreatePackingUnits: boolean;
  canViewShipments: boolean;
  canViewPackingUnits: boolean;
  canViewGlobalShipmentsDashboard: boolean;
  canApproveShipments: boolean;
  dataVisibilityScope: string | null;
}

export function canAccessMador(access: AccessProfile, targetMador: string): boolean {
  return access.role === UserRole.admin || access.accessMador === targetMador;
}

export function canAccessOrgScope(
  access: AccessProfile,
  targetMador: string,
  targetOrgCode: string | null,
): boolean {
  if (access.role === UserRole.admin) return true;
  if (access.role === UserRole.poc && access.accessUnitCode && targetOrgCode) {
    return targetOrgCode.startsWith(access.accessUnitCode);
  }
  return access.accessMador === targetMador;
}

export function assertCanAccessMador(access: AccessProfile, targetMador: string): void {
  if (!canAccessMador(access, targetMador)) {
    throw new ForbiddenException('אין לך הרשאה לפעול במדור שנבחר');
  }
}

export function assertCanAccessOrgScope(
  access: AccessProfile,
  targetMador: string,
  targetOrgCode: string | null,
): void {
  if (!canAccessOrgScope(access, targetMador, targetOrgCode)) {
    throw new ForbiddenException('אין לך הרשאה לפעול במסגרת ארגונית זו');
  }
}

export function assertCanCreatePackingUnit(
  access: AccessProfile,
  targetMador: string,
  targetOrgCode?: string | null,
): void {
  if (!access.canCreatePackingUnits || !canAccessOrgScope(access, targetMador, targetOrgCode ?? null)) {
    throw new ForbiddenException('אין לך הרשאה ליצור יחידת אריזה במדור שנבחר');
  }
}

export function assertCanCreateShipment(
  access: AccessProfile,
  targetMador: string,
  targetOrgCode?: string | null,
): void {
  if (!access.canCreateShipments || !canAccessOrgScope(access, targetMador, targetOrgCode ?? null)) {
    throw new ForbiddenException('אין לך הרשאה ליצור הובלה במדור שנבחר');
  }
}

export function assertCanApproveShipment(
  access: AccessProfile,
  targetOrgCode: string | null,
): void {
  if (!access.canApproveShipments) {
    throw new ForbiddenException('רק קצין קישור רשאי לאשר הובלה');
  }
  if (
    access.role === UserRole.poc &&
    access.accessUnitCode &&
    targetOrgCode &&
    !targetOrgCode.startsWith(access.accessUnitCode)
  ) {
    throw new ForbiddenException('אין לך הרשאה לאשר הובלה של יחידה אחרת');
  }
}
```

- [ ] **Step 2: Update `backend/src/auth/current-user.service.ts`**

Replace the file:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { db } from '../lib/db.js';
import type { AccessProfile } from '../domain/permissions.js';
import { uuidSchema } from '../common/validation.js';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  orgScopeId: string | null;
  orgCode: string | null;
  access: AccessProfile;
}

@Injectable()
export class CurrentUserService {
  listDemoUsers() {
    return db.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        orgScopeId: true,
        orgCode: true,
      },
      orderBy: { email: 'asc' },
    });
  }

  async require(headerValue: string | undefined): Promise<CurrentUser> {
    const parsedId = uuidSchema.safeParse(headerValue);
    if (!parsedId.success) {
      throw new UnauthorizedException('יש לבחור משתמש הדגמה תקין');
    }

    const [user, access] = await Promise.all([
      db.user.findUnique({ where: { id: parsedId.data } }),
      db.userAccessProfile.findFirst({ where: { userId: parsedId.data } }),
    ]);

    if (!user || !access) {
      throw new UnauthorizedException('המשתמש אינו קיים או חסר פרופיל הרשאות');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      orgScopeId: user.orgScopeId,
      orgCode: user.orgCode,
      access: {
        role: access.role,
        accessMador: access.accessMador,
        accessUnitCode: access.accessUnitCode,
        canCreateShipments: access.canCreateShipments,
        canCreatePackingUnits: access.canCreatePackingUnits,
        canViewShipments: access.canViewShipments,
        canViewPackingUnits: access.canViewPackingUnits,
        canViewGlobalShipmentsDashboard: access.canViewGlobalShipmentsDashboard,
        canApproveShipments: access.canApproveShipments,
        dataVisibilityScope: access.dataVisibilityScope,
      },
    };
  }
}
```

- [ ] **Step 3: Update `backend/src/services/auth.service.ts`**

Add `OrgHierarchyService` as a constructor dependency and update `signup`. Replace the file:

```typescript
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OrgScopeLevel, UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { db } from '../lib/db.js';
import type { LoginInput, SignupInput } from '../auth/auth.schemas.js';
import { OrgHierarchyService } from './org-hierarchy.service.js';

export interface AuthenticatedUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  personalNumber: string | null;
  email: string;
  role: UserRole;
  orgScopeId: string | null;
  orgCode: string | null;
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    personalNumber: user.personalNumber,
    email: user.email,
    role: user.role,
    orgScopeId: user.orgScopeId,
    orgCode: user.orgCode,
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly orgHierarchy: OrgHierarchyService) {}

  async signup(input: SignupInput): Promise<AuthenticatedUser> {
    const [existingByPersonalNumber, existingByEmail] = await Promise.all([
      db.user.findUnique({ where: { personalNumber: input.personalNumber } }),
      db.user.findFirst({
        where: { email: { equals: input.email, mode: 'insensitive' } },
      }),
    ]);

    if (existingByPersonalNumber) {
      throw new ConflictException('מספר אישי זה כבר רשום במערכת');
    }
    if (existingByEmail) {
      throw new ConflictException('כתובת אימייל זו כבר רשומה במערכת');
    }

    const orgCode = await this.orgHierarchy.computeOrgCode(
      input.unit,
      input.anaf,
      input.mador,
      input.team,
    );

    const orgScope = await this.findOrCreateOrgScope(input, orgCode);

    const user = await db.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        personalNumber: input.personalNumber,
        email: input.email,
        role: UserRole.normal,
        orgScopeId: orgScope.id,
        orgCode,
      },
    });

    return toAuthenticatedUser(user);
  }

  async login(input: LoginInput): Promise<AuthenticatedUser> {
    const user = await db.user.findUnique({
      where: { personalNumber: input.personalNumber },
    });

    if (!user || user.email.toLowerCase() !== input.email) {
      throw new UnauthorizedException('מספר אישי או אימייל שגויים');
    }

    return toAuthenticatedUser(user);
  }

  private async findOrCreateOrgScope(input: SignupInput, orgCode: string) {
    const existing = await db.orgScope.findFirst({ where: { orgCode } });
    if (existing) return existing;

    return db.orgScope.create({
      data: {
        scopeLevel: OrgScopeLevel.team,
        unit: input.unit,
        anaf: input.anaf,
        mador: input.mador,
        team: input.team,
        orgCode,
      },
    });
  }
}
```

- [ ] **Step 4: Update `backend/src/services/dashboard.service.ts`**

Replace the `scopeFilter` computation to handle POC's unit-code-based scoping. Replace the `get` method:

```typescript
async get(user: CurrentUser) {
  let scopeFilter: object;
  if (user.access.canViewGlobalShipmentsDashboard) {
    scopeFilter = {};
  } else if (user.access.accessUnitCode) {
    scopeFilter = { orgScope: { orgCode: { startsWith: user.access.accessUnitCode } } };
  } else {
    scopeFilter = { orgScope: { mador: user.access.accessMador ?? '' } };
  }

  const discrepancyScopeFilter = user.access.canViewGlobalShipmentsDashboard
    ? {}
    : user.access.accessUnitCode
      ? {
          OR: [
            { shipment: { orgScope: { orgCode: { startsWith: user.access.accessUnitCode } } } },
            { packingUnit: { orgScope: { orgCode: { startsWith: user.access.accessUnitCode } } } },
          ],
        }
      : {
          OR: [
            { shipment: { orgScope: { mador: user.access.accessMador ?? '' } } },
            { packingUnit: { orgScope: { mador: user.access.accessMador ?? '' } } },
          ],
        };

  const [items, packingUnits, shipments, discrepancies] = await Promise.all([
    db.item.groupBy({ by: ['status'], where: scopeFilter, _count: { _all: true }, _sum: { quantity: true } }),
    db.packingUnit.groupBy({ by: ['status'], where: scopeFilter, _count: { _all: true } }),
    db.shipment.groupBy({ by: ['status'], where: scopeFilter, _count: { _all: true } }),
    db.discrepancy.count({ where: { status: { in: ['pending', 'finalized'] }, ...discrepancyScopeFilter } }),
  ]);

  return { items, packingUnits, shipments, discrepancies };
}
```

- [ ] **Step 5: Update `backend/src/services/receiving.service.ts`**

In `listActive`, replace the filter for non-global users:

```typescript
...(orgScopeId
  ? { orgScopeId }
  : user.access.canViewGlobalShipmentsDashboard
    ? {}
    : user.access.accessUnitCode
      ? { orgScope: { orgCode: { startsWith: user.access.accessUnitCode } } }
      : { orgScope: { mador: user.access.accessMador ?? '' } }),
```

In `confirm`, replace the mador assertion:

```typescript
// was: assertCanAccessMador(user.access, shipment.orgScope.mador);
assertCanAccessOrgScope(user.access, shipment.orgScope.mador, shipment.orgScope.orgCode ?? null);
```

Add `assertCanAccessOrgScope` to the import at the top of the file.

Also update the `shipment` query to include `orgScope.orgCode`:
```typescript
const shipment = await db.shipment.findUnique({
  where: { id: shipmentId },
  include: { orgScope: true, packingUnits: true },
});
```
(orgCode is already on orgScope after the migration, so no `include` change needed — just ensure the assertion uses it.)

- [ ] **Step 6: Run the backend TypeScript compiler to check for type errors**

```bash
cd backend && npx tsc --noEmit
```

Fix any type errors (likely around `user.mador` references — change those to `user.access.accessMador`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/domain/permissions.ts backend/src/auth/current-user.service.ts backend/src/services/auth.service.ts backend/src/services/dashboard.service.ts backend/src/services/receiving.service.ts
git commit -m "feat: update permissions and auth for ADMIN/POC/NORMAL roles with org code scoping"
```

---

## Task 4: Admin Backend — User Management + Seed

**Files:**
- Create: `backend/src/services/admin.service.ts`
- Create: `backend/src/controllers/admin.controller.ts`
- Create: `backend/prisma/seed-admin.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `OrgHierarchyService.resolveOrgCode`, `CurrentUserService.require`
- Produces:
  - `GET /api/admin/users` — admin-only, returns list of users with decoded org names
  - `PATCH /api/admin/users/:id/role` — admin-only, sets role to `poc` or `normal`
  - Seed: ensures one admin user exists in DB

- [ ] **Step 1: Create `backend/src/services/admin.service.ts`**

```typescript
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { db } from '../lib/db.js';
import { OrgHierarchyService } from './org-hierarchy.service.js';

export interface AdminUserView {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  personalNumber: string | null;
  role: UserRole;
  orgCode: string | null;
  orgNames: { unit: string; anaf: string; mador: string; team: string } | null;
}

@Injectable()
export class AdminService {
  constructor(private readonly orgHierarchy: OrgHierarchyService) {}

  async listUsers(): Promise<AdminUserView[]> {
    const users = await db.user.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return Promise.all(
      users.map(async (u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        personalNumber: u.personalNumber,
        role: u.role,
        orgCode: u.orgCode,
        orgNames: u.orgCode ? await this.orgHierarchy.resolveOrgCode(u.orgCode) : null,
      })),
    );
  }

  async setUserRole(targetUserId: string, newRole: UserRole.poc | UserRole.normal): Promise<void> {
    const target = await db.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('משתמש לא נמצא');
    if (target.role === UserRole.admin) {
      throw new ForbiddenException('לא ניתן לשנות תפקיד המנהל');
    }

    await db.user.update({ where: { id: targetUserId }, data: { role: newRole } });
  }
}
```

- [ ] **Step 2: Create `backend/src/controllers/admin.controller.ts`**

```typescript
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import { CurrentUserService } from '../auth/current-user.service.js';
import { parseOrThrow } from '../common/validation.js';
import { AdminService } from '../services/admin.service.js';

const setRoleSchema = z.object({
  role: z.enum([UserRole.poc, UserRole.normal]),
});

@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly admin: AdminService,
  ) {}

  private async requireAdmin(headerValue: string | undefined) {
    const user = await this.users.require(headerValue);
    if (user.role !== UserRole.admin) {
      throw new ForbiddenException('גישה מותרת למנהל בלבד');
    }
    return user;
  }

  @Get('users')
  async listUsers(@Headers('x-user-id') userId: string | undefined) {
    await this.requireAdmin(userId);
    return this.admin.listUsers();
  }

  @Patch('users/:id/role')
  async setRole(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') targetId: string,
    @Body() body: unknown,
  ) {
    await this.requireAdmin(userId);
    const { role } = parseOrThrow(setRoleSchema, body);
    await this.admin.setUserRole(targetId, role);
    return { success: true };
  }
}
```

- [ ] **Step 3: Register in `backend/src/app.module.ts`**

Add to the `controllers` array: `AdminController`
Add to the `providers` array: `AdminService`, `OrgHierarchyService`

Also add the import statements at the top:
```typescript
import { AdminController } from './controllers/admin.controller.js';
import { AdminService } from './services/admin.service.js';
import { OrgHierarchyService } from './services/org-hierarchy.service.js';
```

- [ ] **Step 4: Create `backend/prisma/seed-admin.ts`**

```typescript
import { UserRole } from '@prisma/client';
import { db } from '../src/lib/db.js';

async function main() {
  const existing = await db.user.findFirst({ where: { role: UserRole.admin } });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    return;
  }

  const admin = await db.user.create({
    data: {
      email: process.env.ADMIN_EMAIL ?? 'admin@go-south.mil',
      personalNumber: process.env.ADMIN_PERSONAL_NUMBER ?? '0000000',
      firstName: 'מנהל',
      lastName: 'מערכת',
      role: UserRole.admin,
      orgCode: '00000000',
    },
  });

  console.log('Admin seeded:', admin.email, 'personal number:', admin.personalNumber);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
```

- [ ] **Step 5: Run the seed**

```bash
cd backend && npx tsx prisma/seed-admin.ts
```

Expected output: `Admin seeded: admin@go-south.mil personal number: 0000000`

- [ ] **Step 6: Manually test the admin endpoints**

```bash
# Get the admin user ID first
curl http://localhost:3000/api/context

# Then list users
curl -H "x-user-id: <ADMIN_ID>" http://localhost:3000/api/admin/users

# Set a user to POC
curl -X PATCH http://localhost:3000/api/admin/users/<USER_ID>/role \
  -H "Content-Type: application/json" \
  -H "x-user-id: <ADMIN_ID>" \
  -d '{"role":"poc"}'
```

Expected: list returns all users with decoded org names; role update returns `{"success":true}`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/admin.service.ts backend/src/controllers/admin.controller.ts backend/src/app.module.ts backend/prisma/seed-admin.ts
git commit -m "feat: add admin user-management controller and service, seed admin user"
```

---

## Task 5: POC Backend — Unit Dashboard and Shipment Verification

**Files:**
- Create: `backend/src/services/poc.service.ts`
- Create: `backend/src/controllers/poc.controller.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `CurrentUserService.require`, `assertCanApproveShipment`
- Produces:
  - `GET /api/poc/dashboard` — POC-only; returns all shipments for POC's unit
  - `POST /api/poc/shipments/:id/verify` — POC-only; transitions shipment+PUs+items to `verified`

- [ ] **Step 1: Create `backend/src/services/poc.service.ts`**

```typescript
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ItemStatus,
  PackingUnitStatus,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import type { CurrentUser } from '../auth/current-user.service.js';
import { assertCanApproveShipment } from '../domain/permissions.js';
import {
  assertShipmentTransition,
  assertShipmentCanVerify,
} from '../domain/status-transitions.js';
import { db } from '../lib/db.js';

@Injectable()
export class PocService {
  async getUnitDashboard(user: CurrentUser) {
    if (!user.access.accessUnitCode && !user.access.canViewGlobalShipmentsDashboard) {
      throw new ForbiddenException('גישה מותרת לקצין קישור בלבד');
    }

    const whereOrgScope = user.access.canViewGlobalShipmentsDashboard
      ? {}
      : { orgCode: { startsWith: user.access.accessUnitCode! } };

    const orgScopes = await db.orgScope.findMany({ where: whereOrgScope, select: { id: true } });
    const orgScopeIds = orgScopes.map((s) => s.id);

    const shipments = await db.shipment.findMany({
      where: { orgScopeId: { in: orgScopeIds } },
      include: {
        orgScope: true,
        packingUnits: {
          include: { items: true },
          orderBy: { serialNumber: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pending = shipments.filter((s) => s.status === ShipmentStatus.arrived);
    const verified = shipments.filter((s) => s.status === ShipmentStatus.verified);

    return { shipments, pending, verified };
  }

  async verifyShipment(user: CurrentUser, shipmentId: string) {
    const shipment = await db.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        orgScope: true,
        packingUnits: { include: { items: true } },
      },
    });
    if (!shipment) throw new NotFoundException('ההובלה לא נמצאה');

    assertCanApproveShipment(user.access, shipment.orgScope.orgCode ?? null);
    assertShipmentTransition(shipment.status, ShipmentStatus.verified);
    assertShipmentCanVerify(shipment.packingUnits.map((pu) => pu.status));

    await db.$transaction(
      async (tx) => {
        for (const pu of shipment.packingUnits) {
          if (pu.status === PackingUnitStatus.arrived_pending_verification) {
            await tx.packingUnit.update({
              where: { id: pu.id },
              data: { status: PackingUnitStatus.verified },
            });
            await tx.item.updateMany({
              where: {
                packingUnitId: pu.id,
                status: ItemStatus.arrived_pending_verification,
              },
              data: { status: ItemStatus.verified },
            });
          }
        }

        await tx.shipment.update({
          where: { id: shipmentId },
          data: { status: ShipmentStatus.verified },
        });

        await tx.operationEvent.create({
          data: {
            actorUserId: user.id,
            entityType: 'shipment',
            entityId: shipmentId,
            action: 'poc_verified',
            previousState: { status: shipment.status },
            nextState: { status: ShipmentStatus.verified },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { success: true };
  }
}
```

- [ ] **Step 2: Create `backend/src/controllers/poc.controller.ts`**

```typescript
import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUserService } from '../auth/current-user.service.js';
import { PocService } from '../services/poc.service.js';

@Controller('api/poc')
export class PocController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly poc: PocService,
  ) {}

  private async requirePoc(headerValue: string | undefined) {
    const user = await this.users.require(headerValue);
    if (user.role !== UserRole.poc && user.role !== UserRole.admin) {
      throw new ForbiddenException('גישה מותרת לקצין קישור בלבד');
    }
    return user;
  }

  @Get('dashboard')
  async getDashboard(@Headers('x-user-id') userId: string | undefined) {
    const user = await this.requirePoc(userId);
    return this.poc.getUnitDashboard(user);
  }

  @Post('shipments/:id/verify')
  async verifyShipment(
    @Headers('x-user-id') userId: string | undefined,
    @Param('id') shipmentId: string,
  ) {
    const user = await this.requirePoc(userId);
    return this.poc.verifyShipment(user, shipmentId);
  }
}
```

- [ ] **Step 3: Register in `backend/src/app.module.ts`**

Add `PocController` to controllers array.
Add `PocService` to providers array.
Add imports:
```typescript
import { PocController } from './controllers/poc.controller.js';
import { PocService } from './services/poc.service.js';
```

- [ ] **Step 4: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/poc.service.ts backend/src/controllers/poc.controller.ts backend/src/app.module.ts
git commit -m "feat: add POC dashboard and shipment verification endpoints"
```

---

## Task 6: Frontend — Update Types, API Client, and Routing

**Files:**
- Modify: `frontend/src/auth/session.ts`
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces:
  - Updated `AuthenticatedUser` type (add `orgCode`, remove `unit/anaf/mador/team`)
  - `fetchAdminUsers(): Promise<AdminUserView[]>`
  - `setUserRole(userId, role): Promise<void>`
  - `fetchPocDashboard(userId): Promise<PocDashboard>`
  - `verifyShipment(shipmentId, userId): Promise<void>`
  - Route `/admin/users` guarded to `admin` role
  - Route `/poc/dashboard` guarded to `poc` role

- [ ] **Step 1: Update `frontend/src/auth/session.ts`**

Replace `AuthenticatedUser`:

```typescript
export interface AuthenticatedUser {
  id: string
  firstName: string | null
  lastName: string | null
  personalNumber: string | null
  email: string
  role: 'admin' | 'poc' | 'normal'
  orgScopeId: string | null
  orgCode: string | null
}
```

Keep `getCurrentUser`, `getCurrentUserId`, `setCurrentUser`, `clearCurrentUser` unchanged.

- [ ] **Step 2: Update `frontend/src/api/auth.ts`**

Remove `unit`, `anaf`, `mador`, `team` from `SignupPayload` (wait — the backend still accepts them during signup; the response just no longer echoes them back). Actually the payload stays the same — only the `AuthenticatedUser` response type changes. The `SignupPayload` keeps `unit/anaf/mador/team` because the backend needs them to compute the org code. Only the `AuthenticatedUser` (what we get back) changes.

So no changes needed in `api/auth.ts` for the payload. The `AuthenticatedUser` is imported from `session.ts` and already updated.

- [ ] **Step 3: Add admin and POC API functions to `frontend/src/lib/api.ts`**

Add these interfaces and functions at the end of the file:

```typescript
export interface AdminUserView {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  personalNumber: string | null
  role: 'admin' | 'poc' | 'normal'
  orgCode: string | null
  orgNames: { unit: string; anaf: string; mador: string; team: string } | null
}

export interface PocShipment {
  id: string
  description: string
  status: string
  transportAt: string | null
  orgScope: { mador: string; orgCode: string | null }
  packingUnits: {
    id: string
    description: string
    status: string
    serialNumber: number | null
    items: { id: string; description: string; quantity: number; status: string }[]
  }[]
}

export interface PocDashboard {
  shipments: PocShipment[]
  pending: PocShipment[]
  verified: PocShipment[]
}

export async function fetchAdminUsers(userId: string): Promise<AdminUserView[]> {
  const res = await fetch(`${BASE_URL}/api/admin/users`, { headers: headers(userId) })
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`)
  return res.json()
}

export async function setUserRole(
  targetUserId: string,
  role: 'poc' | 'normal',
  actorUserId: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/users/${targetUserId}/role`, {
    method: 'PATCH',
    headers: headers(actorUserId),
    body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Role update failed: ${res.status}`)
  }
}

export async function fetchPocDashboard(userId: string): Promise<PocDashboard> {
  const res = await fetch(`${BASE_URL}/api/poc/dashboard`, { headers: headers(userId) })
  if (!res.ok) throw new Error(`Failed to fetch POC dashboard: ${res.status}`)
  return res.json()
}

export async function verifyShipment(shipmentId: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/poc/shipments/${shipmentId}/verify`, {
    method: 'POST',
    headers: headers(userId),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message ?? `Verification failed: ${res.status}`)
  }
}
```

- [ ] **Step 4: Update `frontend/src/App.tsx`**

Add imports for new pages and session helper. Replace the full file:

```tsx
import { useEffect, useState } from 'react'
import LogisticsMainMenu from './components/LogisticsMainMenu'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignUpPage from './pages/SignUpPage'
import AdminUsersPage from './pages/AdminUsersPage'
import PocDashboardPage from './pages/PocDashboardPage'
import { navigate, usePathname } from './navigation'
import PackingUnitPage from './components/PackingUnitPage'
import ShipmentPage from './components/ShipmentPage'
import { fetchContext, type DemoUser, type OrgScope } from './lib/api'
import { getCurrentUser } from './auth/session'

type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution' | 'admin' | 'poc'

const FALLBACK_USER = {
  name: 'דני',
  personalNumber: '1234567',
  role: 'normal' as const,
}

export default function App() {
  const pathname = usePathname()
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null)
  const [orgScope, setOrgScope] = useState<OrgScope | null>(null)
  const sessionUser = getCurrentUser()

  useEffect(() => {
    if (pathname === '/') navigate('/home', { replace: true })
  }, [])

  useEffect(() => {
    fetchContext()
      .then(({ users, scopes }) => {
        // Prefer the logged-in session user if available
        const target = sessionUser
          ? users.find((u) => u.id === sessionUser.id)
          : users.find((u) => u.role === 'poc') ?? users.find((u) => u.role === 'normal') ?? users[0]
        if (!target) return
        setDemoUser(target)
        if (target.orgScopeId) {
          const scope = scopes.find((s) => s.id === target.orgScopeId) ?? scopes[0]
          setOrgScope(scope ?? null)
        } else if (scopes.length > 0) {
          setOrgScope(scopes[0])
        }
      })
      .catch((err) => console.warn('Could not load backend context:', err))
  }, [sessionUser?.id])

  const handleNavigate = (route: NavigateRoute) => {
    if (route === 'packing') navigate('/packing')
    else if (route === 'transport') navigate('/transport')
    else if (route === 'admin') navigate('/admin/users')
    else if (route === 'poc') navigate('/poc/dashboard')
    else console.log('navigate ->', route)
  }

  const handleBack = () => navigate('/menu')

  const currentRole = sessionUser?.role ?? demoUser?.role ?? 'normal'

  const displayUser = demoUser
    ? {
        name: `${demoUser.firstName ?? ''} ${demoUser.lastName ?? ''}`.trim() || demoUser.email.split('@')[0],
        personalNumber: demoUser.personalNumber ?? demoUser.id,
        role: currentRole,
      }
    : FALLBACK_USER

  if (pathname === '/home') return <HomePage />
  if (pathname === '/login') return <LoginPage />
  if (pathname === '/signup') return <SignUpPage />

  // Role-guarded routes
  if (pathname === '/admin/users') {
    if (currentRole !== 'admin') { navigate('/menu', { replace: true }); return null }
    return <AdminUsersPage userId={demoUser?.id ?? sessionUser?.id ?? null} />
  }
  if (pathname === '/poc/dashboard') {
    if (currentRole !== 'poc' && currentRole !== 'admin') { navigate('/menu', { replace: true }); return null }
    return <PocDashboardPage userId={demoUser?.id ?? sessionUser?.id ?? null} />
  }

  if (pathname === '/packing') return <PackingUnitPage onBack={handleBack} />
  if (pathname === '/transport')
    return (
      <ShipmentPage
        onBack={handleBack}
        userId={demoUser?.id ?? null}
        orgScopeId={orgScope?.id ?? null}
      />
    )

  return <LogisticsMainMenu user={displayUser} onNavigate={handleNavigate} />
}
```

Note: `DemoUser` in `lib/api.ts` needs `firstName`, `lastName`, `personalNumber` added. Update the interface in `lib/api.ts`:

```typescript
export interface DemoUser {
  id: string
  email: string
  role: string
  orgScopeId: string | null
  orgCode: string | null
  firstName?: string | null
  lastName?: string | null
  personalNumber?: string | null
}
```

Also update `CurrentUserService.listDemoUsers` in backend to select `firstName`, `lastName`, `personalNumber`.

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Fix any type errors before continuing.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/auth/session.ts frontend/src/api/auth.ts frontend/src/lib/api.ts frontend/src/App.tsx
git commit -m "feat: update frontend types and routing for ADMIN/POC/NORMAL roles"
```

---

## Task 7: Frontend — AdminUsersPage

**Files:**
- Create: `frontend/src/pages/AdminUsersPage.tsx`

**Interfaces:**
- Consumes: `fetchAdminUsers`, `setUserRole` from `lib/api.ts`
- Props: `userId: string | null`
- Renders: RTL table of all users; admin can click a button per row to toggle POC/NORMAL

- [ ] **Step 1: Create `frontend/src/pages/AdminUsersPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import { ArrowRight } from 'lucide-react'
import { navigate } from '../navigation'
import { fetchAdminUsers, setUserRole, type AdminUserView } from '../lib/api'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

const ROLE_LABEL: Record<string, string> = {
  admin: 'מנהל',
  poc: 'קצין קישור',
  normal: 'משתמש',
}

const ROLE_COLOR: Record<string, 'error' | 'warning' | 'default'> = {
  admin: 'error',
  poc: 'warning',
  normal: 'default',
}

interface Props {
  userId: string | null
}

export default function AdminUsersPage({ userId }: Props) {
  const [users, setUsers] = useState<AdminUserView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    fetchAdminUsers(userId)
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה בטעינת המשתמשים'))
      .finally(() => setLoading(false))
  }, [userId])

  const handleRoleToggle = async (user: AdminUserView) => {
    if (!userId || user.role === 'admin') return
    const newRole: 'poc' | 'normal' = user.role === 'poc' ? 'normal' : 'poc'
    setUpdating(user.id)
    try {
      await setUserRole(user.id, newRole, userId)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בעדכון תפקיד')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <Box dir="rtl" sx={{ minHeight: '100dvh', bgcolor: '#f5f0eb', p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton onClick={() => navigate('/menu')} size="small">
            <ArrowRight />
          </IconButton>
          <Typography
            variant="h5"
            sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a' }}
          >
            ניהול משתמשים
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontFamily: 'Heebo, sans-serif' }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#8B5E3C' }}>
                  {['שם', 'מספר אישי', 'אימייל', 'יחידה', 'תפקיד', 'פעולה'].map((h) => (
                    <TableCell
                      key={h}
                      align="right"
                      sx={{ color: 'white', fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(139,94,60,0.05)' } }}
                  >
                    <TableCell align="right" sx={{ fontFamily: 'Heebo, sans-serif' }}>
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'Heebo, sans-serif', dir: 'ltr' }}>
                      {user.personalNumber ?? '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'Heebo, sans-serif', dir: 'ltr' }}>
                      {user.email}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'Heebo, sans-serif' }}>
                      {user.orgNames?.unit ?? user.orgCode?.substring(0, 2) ?? '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={ROLE_LABEL[user.role] ?? user.role}
                        color={ROLE_COLOR[user.role] ?? 'default'}
                        size="small"
                        sx={{ fontFamily: 'Heebo, sans-serif' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {user.role !== 'admin' && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={updating === user.id}
                          onClick={() => handleRoleToggle(user)}
                          sx={{
                            fontFamily: 'Heebo, sans-serif',
                            borderColor: '#8B5E3C',
                            color: '#8B5E3C',
                          }}
                        >
                          {updating === user.id ? (
                            <CircularProgress size={16} />
                          ) : user.role === 'poc' ? (
                            'הסר קצין קישור'
                          ) : (
                            'הפוך לקצין קישור'
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </ThemeProvider>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AdminUsersPage.tsx
git commit -m "feat: add AdminUsersPage for role management"
```

---

## Task 8: Frontend — PocDashboardPage

**Files:**
- Create: `frontend/src/pages/PocDashboardPage.tsx`

**Interfaces:**
- Consumes: `fetchPocDashboard`, `verifyShipment` from `lib/api.ts`
- Props: `userId: string | null`
- Renders: list of arrived shipments pending verification; verify button per shipment

- [ ] **Step 1: Create `frontend/src/pages/PocDashboardPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import { ArrowRight, ChevronDown, CheckCircle, Clock } from 'lucide-react'
import { navigate } from '../navigation'
import { fetchPocDashboard, verifyShipment, type PocDashboard, type PocShipment } from '../lib/api'

const theme = createTheme({
  direction: 'rtl',
  typography: { fontFamily: 'Heebo, sans-serif' },
})

const STATUS_LABEL: Record<string, string> = {
  not_sent: 'טרם נשלח',
  sent: 'בדרך',
  arrived: 'הגיע — ממתין לאימות',
  verified: 'מאומת',
}

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'info'> = {
  not_sent: 'default',
  sent: 'info',
  arrived: 'warning',
  verified: 'success',
}

interface Props {
  userId: string | null
}

function ShipmentCard({
  shipment,
  onVerify,
  verifying,
}: {
  shipment: PocShipment
  onVerify?: () => void
  verifying: boolean
}) {
  return (
    <Accordion
      elevation={0}
      sx={{
        borderRadius: '12px !important',
        border: '1px solid rgba(139,94,60,0.2)',
        mb: 1,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ChevronDown size={18} />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', pr: 1 }}>
          <Chip
            label={STATUS_LABEL[shipment.status] ?? shipment.status}
            color={STATUS_COLOR[shipment.status] ?? 'default'}
            size="small"
            sx={{ fontFamily: 'Heebo, sans-serif' }}
          />
          <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 600, flexGrow: 1 }}>
            {shipment.description}
          </Typography>
          {shipment.status === 'arrived' && onVerify && (
            <Button
              size="small"
              variant="contained"
              disabled={verifying}
              onClick={(e) => { e.stopPropagation(); onVerify() }}
              sx={{
                fontFamily: 'Heebo, sans-serif',
                bgcolor: '#8B5E3C',
                '&:hover': { bgcolor: '#7a5232' },
                flexShrink: 0,
              }}
            >
              {verifying ? <CircularProgress size={16} color="inherit" /> : 'אשר קבלה'}
            </Button>
          )}
          {shipment.status === 'verified' && (
            <CheckCircle size={18} color="#4caf50" />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {shipment.packingUnits.length === 0 ? (
          <Typography sx={{ fontFamily: 'Heebo, sans-serif', color: 'text.secondary' }}>
            אין יחידות אריזה
          </Typography>
        ) : (
          shipment.packingUnits.map((pu) => (
            <Box key={pu.id} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={STATUS_LABEL[pu.status] ?? pu.status}
                  color={STATUS_COLOR[pu.status] ?? 'default'}
                  size="small"
                  sx={{ fontFamily: 'Heebo, sans-serif' }}
                />
                <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}>
                  {pu.description} {pu.serialNumber != null ? `(#${pu.serialNumber})` : ''}
                </Typography>
              </Box>
              {pu.items.length > 0 && (
                <Box component="ul" sx={{ mt: 0.5, mb: 0, pr: 3 }}>
                  {pu.items.map((item) => (
                    <Typography
                      key={item.id}
                      component="li"
                      sx={{ fontFamily: 'Heebo, sans-serif', fontSize: '0.85rem', color: 'text.secondary' }}
                    >
                      {item.description} × {item.quantity}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          ))
        )}
      </AccordionDetails>
    </Accordion>
  )
}

export default function PocDashboardPage({ userId }: Props) {
  const [dashboard, setDashboard] = useState<PocDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)

  const load = () => {
    if (!userId) return
    setLoading(true)
    fetchPocDashboard(userId)
      .then(setDashboard)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה בטעינת הדשבורד'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [userId])

  const handleVerify = async (shipmentId: string) => {
    if (!userId) return
    setVerifying(shipmentId)
    try {
      await verifyShipment(shipmentId, userId)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה באימות הובלה')
    } finally {
      setVerifying(null)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <Box dir="rtl" sx={{ minHeight: '100dvh', bgcolor: '#f5f0eb', p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton onClick={() => navigate('/menu')} size="small">
            <ArrowRight />
          </IconButton>
          <Typography
            variant="h5"
            sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a' }}
          >
            דשבורד קצין קישור
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, fontFamily: 'Heebo, sans-serif' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress />
          </Box>
        ) : dashboard ? (
          <Box>
            {/* Pending verification */}
            <Paper
              elevation={0}
              sx={{ borderRadius: 3, p: 2.5, mb: 3, border: '1px solid rgba(255,152,0,0.3)', bgcolor: 'rgba(255,152,0,0.05)' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Clock size={20} color="#f57c00" />
                <Typography sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#f57c00' }}>
                  ממתינות לאישור ({dashboard.pending.length})
                </Typography>
              </Box>
              {dashboard.pending.length === 0 ? (
                <Typography sx={{ fontFamily: 'Heebo, sans-serif', color: 'text.secondary' }}>
                  אין הובלות הממתינות לאישור
                </Typography>
              ) : (
                dashboard.pending.map((s) => (
                  <ShipmentCard
                    key={s.id}
                    shipment={s}
                    onVerify={() => handleVerify(s.id)}
                    verifying={verifying === s.id}
                  />
                ))
              )}
            </Paper>

            {/* All shipments */}
            <Typography
              sx={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700, color: '#2d1b0a', mb: 1.5 }}
            >
              כל ההובלות ({dashboard.shipments.length})
            </Typography>
            {dashboard.shipments.map((s) => (
              <ShipmentCard
                key={s.id}
                shipment={s}
                onVerify={s.status === 'arrived' ? () => handleVerify(s.id) : undefined}
                verifying={verifying === s.id}
              />
            ))}
          </Box>
        ) : null}
      </Box>
    </ThemeProvider>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PocDashboardPage.tsx
git commit -m "feat: add PocDashboardPage for unit shipment monitoring and verification"
```

---

## Task 9: Frontend — Role Badge and Navigation Cards

**Files:**
- Modify: `frontend/src/components/LogisticsMainMenu.tsx`

**Goal:** Show the user's role in Hebrew as a chip in the header, and add role-specific navigation cards (admin → user management, POC → dashboard).

- [ ] **Step 1: Update `frontend/src/components/LogisticsMainMenu.tsx`**

Update the `User` interface and add role-dependent cards:

```typescript
// Update the User interface
interface User {
  name: string
  personalNumber?: string
  role?: string
}
```

Add a role label map and role badge just after the greeting text, and add role-specific cards. Here is the full updated component's changed sections:

a) Add at the top of the component function (after the existing state declarations):

```typescript
const ROLE_LABEL: Record<string, string> = {
  admin: 'מנהל',
  poc: 'קצין קישור',
  normal: 'משתמש',
}

const roleLabel = user.role ? (ROLE_LABEL[user.role] ?? user.role) : null
```

b) Add an `admin` card and `poc` card to the appropriate tabs. Update `NavigateRoute` in the file to include `'admin' | 'poc'`:

```typescript
type NavigateRoute = 'packing' | 'transport' | 'receiving' | 'distribution' | 'admin' | 'poc'
```

c) Add a role chip below the greeting text. In the JSX, after the `<Typography>שלום {user.name}...</Typography>` block, add:

```tsx
{roleLabel && (
  <Chip
    label={roleLabel}
    size="small"
    sx={{
      fontFamily: 'Heebo, sans-serif',
      fontWeight: 600,
      bgcolor: user.role === 'admin'
        ? 'rgba(211,47,47,0.85)'
        : user.role === 'poc'
          ? 'rgba(245,124,0,0.85)'
          : 'rgba(76,175,80,0.85)',
      color: 'white',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.3)',
    }}
  />
)}
```

Add `Chip` to the MUI imports at the top of the file.

d) Add role-specific action cards. At the top of the file, add:

```typescript
const ADMIN_CARDS: ActionCardItem[] = [
  { label: 'ניהול משתמשים', route: 'admin', Icon: Users },
]

const POC_CARDS: ActionCardItem[] = [
  { label: 'דשבורד קישור', route: 'poc', Icon: BarChart3 },
]
```

Add `Users` and `BarChart3` to the lucide-react imports.

e) Update the `cards` computation to prepend role-specific cards:

```typescript
const baseCards = activeTab === 'sending' ? SENDING_CARDS : RECEIVING_CARDS
const roleCards = user.role === 'admin' ? ADMIN_CARDS : user.role === 'poc' ? POC_CARDS : []
const cards = [...roleCards, ...baseCards]
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Smoke test in the browser**

Start both dev servers:
```bash
# Terminal 1
cd backend && npm run start:dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173`. Log in as admin (personal number `0000000`, email `admin@go-south.mil`). Verify:
- Role chip shows "מנהל" in the header
- "ניהול משתמשים" card appears
- Clicking it navigates to `/admin/users`
- `/admin/users` shows all users with role chips and toggle buttons

Log in as a POC user (first grant POC via admin). Verify:
- Role chip shows "קצין קישור"
- "דשבורד קישור" card appears
- `/poc/dashboard` shows shipments pending verification
- Clicking "אשר קבלה" on an arrived shipment marks it verified

Log in as a NORMAL user. Verify:
- Role chip shows "משתמש"
- No admin or POC cards shown
- Attempting to navigate to `/admin/users` redirects to `/menu`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/LogisticsMainMenu.tsx
git commit -m "feat: add role chip and role-specific navigation cards to main menu"
```
