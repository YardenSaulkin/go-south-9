export class OrgCodeError extends Error {
  constructor() {
    super('קוד ארגוני חייב להכיל 8 ספרות');
    this.name = 'OrgCodeError';
  }
}

export interface OrgCodeHierarchy {
  unitCode: string;
  anafCode: string;
  madorCode: string;
  teamCode: string;
}

export function parseOrgCode(code: string): OrgCodeHierarchy {
  const normalized = code.trim();
  if (!/^\d{8}$/.test(normalized)) throw new OrgCodeError();

  return {
    unitCode: normalized.slice(0, 2),
    anafCode: normalized.slice(2, 4),
    madorCode: normalized.slice(4, 6),
    teamCode: normalized.slice(6, 8),
  };
}
