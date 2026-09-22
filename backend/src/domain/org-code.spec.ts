import { describe, expect, it } from 'vitest';
import { OrgCodeError, parseOrgCode } from './org-code.js';

describe('organizational code hierarchy', () => {
  it('parses an eight-digit team-level code into two-digit hierarchy segments', () => {
    expect(parseOrgCode('12345678')).toEqual({
      unitCode: '12',
      anafCode: '34',
      madorCode: '56',
      teamCode: '78',
    });
  });

  it.each(['123', 'ABCDEFGH', '123456789', '12 34 56'])('rejects invalid full codes: %s', (code) => {
    expect(() => parseOrgCode(code)).toThrow(OrgCodeError);
  });
});
