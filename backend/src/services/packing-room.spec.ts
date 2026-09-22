import { describe, expect, it } from 'vitest';
import { eligibleItemsWhere } from './packing.service.js';

describe('room-based packing-item visibility', () => {
  it('selects eligible Items by source room and scope, not item owner or creator', () => {
    const where = eligibleItemsWhere(
      '123e4567-e89b-12d3-a456-426614174000',
      'Room 100',
    );

    expect(where).toMatchObject({
      orgScopeId: '123e4567-e89b-12d3-a456-426614174000',
      sourceRoomId: 'Room 100',
      packingUnitId: null,
    });
    expect(where).not.toHaveProperty('ownerUserId');
    expect(where).not.toHaveProperty('createdByUserId');
  });

  it('does not return a different room when the selected room changes', () => {
    const room100 = eligibleItemsWhere('scope-1', 'Room 100');
    const room101 = eligibleItemsWhere('scope-1', 'Room 101');

    expect(room100.sourceRoomId).toBe('Room 100');
    expect(room101.sourceRoomId).toBe('Room 101');
    expect(room100.sourceRoomId).not.toBe(room101.sourceRoomId);
  });
});
