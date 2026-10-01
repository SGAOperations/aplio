import { describe, expect, it } from 'vitest';

import {
  buildNavGroups,
  manageReviewerNavItems,
  settingsNavItems,
} from '@/components/layouts/nav-items';

describe('buildNavGroups', () => {
  it('returns no groups for a plain applicant', () => {
    expect(
      buildNavGroups({ canReviewApplications: false, isAdmin: false }),
    ).toEqual([]);
  });

  it('includes Manage only for a reviewer (manager or admin)', () => {
    const groups = buildNavGroups({
      canReviewApplications: true,
      isAdmin: false,
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'nav-group-manage',
      items: manageReviewerNavItems,
    });
  });

  it('includes Settings, with /insights, only for an admin', () => {
    const groups = buildNavGroups({
      canReviewApplications: false,
      isAdmin: true,
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      id: 'nav-group-settings',
      items: settingsNavItems,
    });
    expect(groups[0]?.items.map((i) => i.href)).toContain('/insights');
  });

  it('includes both groups for an admin who also reviews', () => {
    const groups = buildNavGroups({
      canReviewApplications: true,
      isAdmin: true,
    });
    expect(groups.map((g) => g.id)).toEqual([
      'nav-group-manage',
      'nav-group-settings',
    ]);
  });
});
