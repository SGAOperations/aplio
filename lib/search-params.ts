import {
  type UrlKeys,
  createLoader,
  createMultiParser,
  createParser,
  createSerializer,
} from 'nuqs/server';

import {
  APPLICATION_SORT_DIRECTIONS,
  APPLICATION_SORT_FIELDS,
  APPLICATION_STATUS_VALUES,
  EMAIL_STATUS_VALUES,
  EMAIL_TEMPLATE_VALUES,
  FILTER_PARAM_MAX_LENGTH,
  FILTER_PARAM_MAX_VALUES,
  FILTER_QUERY_MAX_LENGTH,
  USER_ROLE_FILTER_VALUES,
} from '@/lib/constants';
import type {
  ApplicationFilters,
  ApplicationSort,
  EmailLogFilters,
} from '@/lib/types';

// Allow-list enum arrays in canonical order, deduped; eq lets nuqs skip no-op writes.
function parseAsFilterEnum<T extends string>(allowed: readonly T[]) {
  return createMultiParser<T[]>({
    parse: (values) => allowed.filter((v) => values.includes(v)),
    serialize: (value) => value,
    eq: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
  }).withDefault([]);
}

// Opaque ids: trims, dedupes, sorts, and caps at FILTER_PARAM_MAX_VALUES against an unbounded `IN`.
const parseAsFilterIds = createMultiParser<string[]>({
  parse: (values) => {
    const cleaned = new Set<string>();
    for (const raw of values) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.length > FILTER_PARAM_MAX_LENGTH) continue;
      cleaned.add(trimmed);
    }
    return [...cleaned].sort().slice(0, FILTER_PARAM_MAX_VALUES);
  },
  serialize: (value) => value,
  eq: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
}).withDefault([]);

const parseAsFilterQuery = createParser<string>({
  parse: (value) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > FILTER_QUERY_MAX_LENGTH) return null;
    return trimmed;
  },
  serialize: (value) => value,
});

const parseAsPageNumber = createParser<number>({
  parse: (value) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1 || n > 10_000) return null;
    return n;
  },
  serialize: (value) => String(value),
}).withDefault(1);

const parseAsApplicationSort = createParser<ApplicationSort>({
  parse: (value) => {
    const [field, direction] = value.split(':');
    if (!(APPLICATION_SORT_FIELDS as readonly string[]).includes(field ?? ''))
      return null;
    if (
      !(APPLICATION_SORT_DIRECTIONS as readonly string[]).includes(
        direction ?? '',
      )
    )
      return null;
    return {
      field: field as ApplicationSort['field'],
      direction: direction as ApplicationSort['direction'],
    };
  },
  serialize: (value) => `${value.field}:${value.direction}`,
  eq: (a, b) => a.field === b.field && a.direction === b.direction,
});

// Plural fields, singular/repeated URL params for back-compat; key order matters (buildApplicationsHref relies on it).
export const applicationsSearchParams = {
  positionIds: parseAsFilterIds,
  statuses: parseAsFilterEnum(APPLICATION_STATUS_VALUES),
  userIds: parseAsFilterIds,
  q: parseAsFilterQuery,
  sort: parseAsApplicationSort,
  page: parseAsPageNumber,
};

export const applicationsUrlKeys: UrlKeys<typeof applicationsSearchParams> = {
  positionIds: 'positionId',
  statuses: 'status',
  userIds: 'userId',
};

export const loadApplicationsSearchParams = createLoader(
  applicationsSearchParams,
  { urlKeys: applicationsUrlKeys },
);

const serializeApplicationsHref = createSerializer(applicationsSearchParams, {
  urlKeys: applicationsUrlKeys,
});

/** `/manage/applications` link for a filter set + page; omits `page=1`. */
export function buildApplicationsHref(
  filters: ApplicationFilters,
  page?: number,
): string {
  return serializeApplicationsHref('/manage/applications', {
    positionIds: filters.positionIds?.length ? filters.positionIds : null,
    statuses: filters.statuses?.length ? filters.statuses : null,
    userIds: filters.userIds?.length ? filters.userIds : null,
    q: filters.q ?? null,
    sort: filters.sort ?? null,
    page: page && page > 1 ? page : null,
  });
}

export const emailLogSearchParams = {
  statuses: parseAsFilterEnum(EMAIL_STATUS_VALUES),
  templates: parseAsFilterEnum(EMAIL_TEMPLATE_VALUES),
  q: parseAsFilterQuery,
  page: parseAsPageNumber,
};

export const emailLogUrlKeys: UrlKeys<typeof emailLogSearchParams> = {
  statuses: 'status',
  templates: 'template',
};

export const loadEmailLogSearchParams = createLoader(emailLogSearchParams, {
  urlKeys: emailLogUrlKeys,
});

const serializeEmailLogHref = createSerializer(emailLogSearchParams, {
  urlKeys: emailLogUrlKeys,
});

/** `/emails` link for a filter set + page; omits `page=1`. */
export function buildEmailLogHref(
  filters: EmailLogFilters,
  page?: number,
): string {
  return serializeEmailLogHref('/emails', {
    statuses: filters.statuses?.length ? filters.statuses : null,
    templates: filters.templates?.length ? filters.templates : null,
    q: filters.q ?? null,
    page: page && page > 1 ? page : null,
  });
}

export const usersSearchParams = {
  roles: parseAsFilterEnum(USER_ROLE_FILTER_VALUES),
  positionIds: parseAsFilterIds,
};

export const usersUrlKeys: UrlKeys<typeof usersSearchParams> = {
  roles: 'role',
  positionIds: 'position',
};
