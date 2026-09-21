import { describe, expect, it } from 'vitest';

import { DeadlineIndicator } from '@/components/features/deadline-indicator';

const NOW = new Date('2026-03-10T00:00:00Z');
const pastPosition = {
  status: 'open' as const,
  opensAt: null,
  closesAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
};

describe('DeadlineIndicator', () => {
  it('renders a past deadline identically regardless of emphasizeUrgency', () => {
    const emphasized = DeadlineIndicator({
      position: pastPosition,
      now: NOW,
      emphasizeUrgency: true,
    });
    const muted = DeadlineIndicator({
      position: pastPosition,
      now: NOW,
      emphasizeUrgency: false,
    });
    expect(emphasized).toEqual(muted);
  });
});
