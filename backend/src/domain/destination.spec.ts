import { describe, expect, it } from 'vitest';
import { destinationSelectionSchema } from './destination.js';

describe('packing destination selection', () => {
  it('accepts an existing destination by operational identifier only', () => {
    expect(destinationSelectionSchema.parse({
      mode: 'existing',
      destinationId: 'DEST-100',
    })).toEqual({
      mode: 'existing',
      destinationId: 'DEST-100',
    });
  });

  it('requires authoritative details when creating a new destination', () => {
    expect(destinationSelectionSchema.safeParse({
      mode: 'new',
      destinationId: 'DEST-200',
      description: 'מחסן תקשוב',
      building: 'ב',
      floor: '2',
      room: '208',
    }).success).toBe(true);
    expect(destinationSelectionSchema.safeParse({
      mode: 'new',
      destinationId: 'DEST-200',
      description: '',
      building: 'ב',
      floor: '2',
      room: '208',
    }).success).toBe(false);
    expect(destinationSelectionSchema.safeParse({
      mode: 'new',
      destinationId: '',
      description: 'מחסן תקשוב',
      building: 'ב',
      floor: '2',
      room: '208',
    }).success).toBe(false);
  });
});
