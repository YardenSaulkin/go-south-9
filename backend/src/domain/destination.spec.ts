import { describe, expect, it } from 'vitest';
import { destinationSelectionSchema } from './destination.js';

describe('packing destination selection', () => {
  it('accepts an existing destination by internal identifier only', () => {
    expect(destinationSelectionSchema.parse({
      mode: 'existing',
      destinationId: '123e4567-e89b-12d3-a456-426614174000',
    })).toEqual({
      mode: 'existing',
      destinationId: '123e4567-e89b-12d3-a456-426614174000',
    });
  });

  it('requires authoritative details when creating a new destination', () => {
    expect(destinationSelectionSchema.safeParse({
      mode: 'new',
      description: 'מחסן תקשוב',
      building: 'ב',
      floor: '2',
      room: '208',
    }).success).toBe(true);
    expect(destinationSelectionSchema.safeParse({
      mode: 'new',
      description: '',
      building: 'ב',
      floor: '2',
      room: '208',
    }).success).toBe(false);
  });
});
