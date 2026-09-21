import { describe, expect, it } from 'vitest';

import { DeadlineIndicator } from '@/components/features/deadline-indicator';

const NOW = new Date('2026-03-10T00:00:00Z');
const pastPosition = {
  status: 'open' as const,
  opensAt: null,
  closesAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
};
const distantPosition = {
  status: 'open' as const,
  opensAt: null,
  closesAt: new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
};
const soonPosition = {
  status: 'open' as const,
  opensAt: null,
  closesAt: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000),
};

function classNameOf(element: unknown): string {
  return (element as { props: { className: string } }).props.className;
}

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

  it.each([
    ['distant', distantPosition],
    ['soon', soonPosition],
  ])(
    'renders %s red with the warning icon when emphasizeUrgency is true',
    (_tier, position) => {
      const element = DeadlineIndicator({
        position,
        now: NOW,
        emphasizeUrgency: true,
      });
      expect(classNameOf(element)).toContain('text-destructive-text');
      expect(classNameOf(element)).not.toContain('text-warning-text');
    },
  );

  it.each([
    ['distant', distantPosition],
    ['soon', soonPosition],
  ])('renders %s muted when emphasizeUrgency is false', (_tier, position) => {
    const element = DeadlineIndicator({
      position,
      now: NOW,
      emphasizeUrgency: false,
    });
    expect(classNameOf(element)).toContain('text-muted-foreground');
  });
});
