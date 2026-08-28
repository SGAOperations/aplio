import { describe, expect, it } from 'vitest';

import {
  ACTION_ICONS,
  APPLICATION_STATUS_ICONS,
  CONCEPT_ICONS,
  FILE_TYPE_ICONS,
  POSITION_AVAILABILITY_ICONS,
  POSITION_STATUS_ICONS,
  STATE_ICONS,
} from '@/lib/icons';

const maps = {
  CONCEPT_ICONS,
  APPLICATION_STATUS_ICONS,
  POSITION_STATUS_ICONS,
  ACTION_ICONS,
  STATE_ICONS,
  FILE_TYPE_ICONS,
};

describe('icon vocabulary', () => {
  for (const [name, map] of Object.entries(maps)) {
    it(`${name} has no duplicate icons`, () => {
      const icons = Object.values(map);
      expect(new Set(icons).size).toBe(icons.length);
    });
  }

  // 'closed_by_date' and 'unavailable' both mean "closed" (POSITION_AVAILABILITY_LABELS),
  // so sharing an icon is intentional; every other key must be distinct.
  it('POSITION_AVAILABILITY_ICONS has no duplicates beyond the two closed states', () => {
    const { accepting, upcoming, closed_by_date, unavailable } =
      POSITION_AVAILABILITY_ICONS;
    expect(new Set([accepting, upcoming, closed_by_date]).size).toBe(3);
    expect(closed_by_date).toBe(unavailable);
  });
});
