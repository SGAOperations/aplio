import { describe, expect, it } from 'vitest';

import {
  FILTER_PARAM_MAX_LENGTH,
  FILTER_PARAM_MAX_VALUES,
  FILTER_QUERY_MAX_LENGTH,
} from '@/lib/constants';
import {
  applicationsSearchParams,
  applicationsUrlKeys,
  buildApplicationsHref,
  buildEmailLogHref,
  emailLogSearchParams,
  emailLogUrlKeys,
  loadApplicationsSearchParams,
  loadEmailLogSearchParams,
  loadInsightsSearchParams,
  usersSearchParams,
  usersUrlKeys,
} from '@/lib/search-params';

describe('buildApplicationsHref', () => {
  it('returns the bare path with no filters or page', () => {
    expect(buildApplicationsHref({})).toBe('/manage/applications');
  });

  it('round-trips every filter field', () => {
    const href = buildApplicationsHref({
      positionIds: ['pos1'],
      statuses: ['draft'],
      userIds: ['user1'],
      q: 'jane',
      sort: { field: 'name', direction: 'asc' },
    });
    const parsed = loadApplicationsSearchParams(href.split('?')[1] ?? '');
    expect(parsed).toEqual({
      positionIds: ['pos1'],
      statuses: ['draft'],
      userIds: ['user1'],
      q: 'jane',
      sort: { field: 'name', direction: 'asc' },
      page: 1,
    });
  });

  it('encodes a repeated multi-value filter as separate params', () => {
    const href = buildApplicationsHref({ statuses: ['applied', 'draft'] });
    expect(href).toBe('/manage/applications?status=applied&status=draft');
  });

  it('omits page=1', () => {
    expect(buildApplicationsHref({ statuses: ['draft'] }, 1)).toBe(
      '/manage/applications?status=draft',
    );
  });

  it('includes page when past 1', () => {
    expect(buildApplicationsHref({ statuses: ['draft'] }, 2)).toBe(
      '/manage/applications?status=draft&page=2',
    );
  });

  it('drops an empty array rather than emitting a stray key', () => {
    expect(buildApplicationsHref({ positionIds: [] })).toBe(
      '/manage/applications',
    );
  });
});

describe('buildEmailLogHref', () => {
  it('returns the bare path with no filters or page', () => {
    expect(buildEmailLogHref({})).toBe('/emails');
  });

  it('round-trips every filter field', () => {
    const href = buildEmailLogHref({
      q: 'jane@example.com',
      statuses: ['bounced'],
      templates: ['otp'],
    });
    const parsed = loadEmailLogSearchParams(href.split('?')[1] ?? '');
    expect(parsed).toEqual({
      statuses: ['bounced'],
      templates: ['otp'],
      q: 'jane@example.com',
      page: 1,
    });
  });

  it('omits page=1', () => {
    expect(buildEmailLogHref({ statuses: ['bounced'] }, 1)).toBe(
      '/emails?status=bounced',
    );
  });

  it('includes page when past 1', () => {
    expect(buildEmailLogHref({ statuses: ['bounced'] }, 2)).toBe(
      '/emails?status=bounced&page=2',
    );
  });
});

describe('loadApplicationsSearchParams', () => {
  it('defaults every field when the URL is empty', () => {
    expect(loadApplicationsSearchParams('')).toEqual({
      positionIds: [],
      statuses: [],
      userIds: [],
      q: null,
      sort: null,
      page: 1,
    });
  });

  it('a single-value legacy deep link parses as a one-element array', () => {
    expect(loadApplicationsSearchParams('status=applied').statuses).toEqual([
      'applied',
    ]);
  });

  it('drops an unknown status but keeps the rest of the list', () => {
    expect(
      loadApplicationsSearchParams('status=bogus&status=applied').statuses,
    ).toEqual(['applied']);
  });

  it('dedupes and caps an oversized id list', () => {
    const ids = Array.from({ length: FILTER_PARAM_MAX_VALUES + 10 }, (_, i) =>
      `id${i}`.repeat(1),
    );
    const params = ids.map((id) => `positionId=${id}`).join('&');
    const result = loadApplicationsSearchParams(params);
    expect(result.positionIds.length).toBe(FILTER_PARAM_MAX_VALUES);
  });

  it('drops an id longer than FILTER_PARAM_MAX_LENGTH', () => {
    const tooLong = 'x'.repeat(FILTER_PARAM_MAX_LENGTH + 1);
    const result = loadApplicationsSearchParams(`positionId=${tooLong}`);
    expect(result.positionIds).toEqual([]);
  });

  it('drops a query over FILTER_QUERY_MAX_LENGTH', () => {
    const tooLong = 'x'.repeat(FILTER_QUERY_MAX_LENGTH + 1);
    expect(loadApplicationsSearchParams(`q=${tooLong}`).q).toBeNull();
  });

  it('falls back to page 1 for junk or an absurd offset', () => {
    expect(loadApplicationsSearchParams('page=bogus').page).toBe(1);
    expect(loadApplicationsSearchParams('page=999999').page).toBe(1);
  });

  it('drops an unparseable sort', () => {
    expect(loadApplicationsSearchParams('sort=bogus').sort).toBeNull();
  });
});

describe('loadEmailLogSearchParams', () => {
  it('defaults every field when the URL is empty', () => {
    expect(loadEmailLogSearchParams('')).toEqual({
      statuses: [],
      templates: [],
      q: null,
      page: 1,
    });
  });

  it('a single-value legacy deep link parses as a one-element array', () => {
    expect(loadEmailLogSearchParams('status=bounced').statuses).toEqual([
      'bounced',
    ]);
  });
});

describe('loadInsightsSearchParams', () => {
  it('defaults to the 90-day preset with no from/to', () => {
    expect(loadInsightsSearchParams('')).toEqual({
      range: '90d',
      from: null,
      to: null,
    });
  });

  it('parses a valid custom range', () => {
    expect(
      loadInsightsSearchParams('range=custom&from=2026-01-01&to=2026-02-01'),
    ).toEqual({ range: 'custom', from: '2026-01-01', to: '2026-02-01' });
  });

  it('rejects a calendar-invalid date', () => {
    expect(loadInsightsSearchParams('from=2026-02-30').from).toBeNull();
  });

  it('rejects garbage', () => {
    expect(loadInsightsSearchParams('from=garbage').from).toBeNull();
    expect(loadInsightsSearchParams('to=').to).toBeNull();
  });

  it('falls back to the default preset for an unknown range value', () => {
    expect(loadInsightsSearchParams('range=bogus').range).toBe('90d');
  });
});

describe('search param maps', () => {
  it('applicationsUrlKeys maps every plural field name to its singular, repeating URL key', () => {
    expect(applicationsUrlKeys).toEqual({
      positionIds: 'positionId',
      statuses: 'status',
      userIds: 'userId',
    });
  });

  it('emailLogUrlKeys maps every plural field name to its singular, repeating URL key', () => {
    expect(emailLogUrlKeys).toEqual({
      statuses: 'status',
      templates: 'template',
    });
  });

  it('usersUrlKeys maps every plural field name to its singular, repeating URL key', () => {
    expect(usersUrlKeys).toEqual({ roles: 'role', positionIds: 'position' });
  });

  it('declares every documented field for each page', () => {
    expect(Object.keys(applicationsSearchParams)).toEqual([
      'positionIds',
      'statuses',
      'userIds',
      'q',
      'sort',
      'page',
    ]);
    expect(Object.keys(emailLogSearchParams)).toEqual([
      'statuses',
      'templates',
      'q',
      'page',
    ]);
    expect(Object.keys(usersSearchParams)).toEqual(['roles', 'positionIds']);
  });
});
