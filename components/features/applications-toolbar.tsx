'use client';

import { useMemo } from 'react';

import { debounce, useQueryStates } from 'nuqs';

import {
  APPLICATION_STATUS_OPTIONS,
  FILTER_SEARCH_DEBOUNCE_MS,
} from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import {
  applicationsSearchParams,
  applicationsUrlKeys,
} from '@/lib/search-params';
import type { ReviewableApplicant } from '@/lib/types';
import { displayUserName, getApplicationViewMode } from '@/lib/utils';

import { ApplicationStatusDot } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import {
  DataTableToolbar,
  DataTableToolbarField,
} from '@/components/ui/data-table-toolbar';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';

interface ApplicationsToolbarProps {
  positions: { id: string; title: string }[];
  applicants: ReviewableApplicant[];
  hasActiveFilters: boolean;
}

export function ApplicationsToolbar({
  positions,
  applicants,
  hasActiveFilters,
}: ApplicationsToolbarProps) {
  const [params, setParams] = useQueryStates(applicationsSearchParams, {
    urlKeys: applicationsUrlKeys,
    history: 'push',
    shallow: false,
    scroll: false,
  });

  // A draft's submittedAt is null, so buildDraftListWhere's q filter never matches one by date.
  const viewMode = getApplicationViewMode(params.statuses);

  // Only ambiguous names get the disambiguating email suffix.
  const applicantOptions = useMemo(() => {
    const nameCounts = new Map<string, number>();
    for (const a of applicants) {
      const key = displayUserName(a);
      nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
    }
    return applicants.map((a) => {
      const key = displayUserName(a);
      const label =
        (nameCounts.get(key) ?? 0) > 1 ? `${key} · ${a.email}` : key;
      return { value: a.id, label };
    });
  }, [applicants]);

  const positionOptions = useMemo(
    () => positions.map((p) => ({ value: p.id, label: p.title })),
    [positions],
  );

  const statusOptions = useMemo(
    () =>
      APPLICATION_STATUS_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        icon: <ApplicationStatusDot status={opt.value} />,
      })),
    [],
  );

  function clearFilters() {
    // Drops userId too, so a zero-result filter set isn't a per-user deep-link dead end.
    void setParams(null);
  }

  return (
    <DataTableToolbar>
      <DataTableToolbarField
        label="Position"
        htmlFor="filter-position"
        className="w-full sm:w-48"
      >
        <MultiSelect
          id="filter-position"
          options={positionOptions}
          values={params.positionIds}
          onValuesChange={(positionIds) =>
            void setParams({ positionIds, page: null })
          }
          placeholder="All positions"
          noun="position"
          searchable
        />
      </DataTableToolbarField>

      <DataTableToolbarField
        label="Applicant"
        htmlFor="filter-applicant"
        className="w-full sm:w-56"
      >
        <MultiSelect
          id="filter-applicant"
          options={applicantOptions}
          values={params.userIds}
          onValuesChange={(userIds) => void setParams({ userIds, page: null })}
          placeholder={
            applicants.length === 0 ? 'No applicants yet' : 'All applicants'
          }
          noun="applicant"
          searchable
          unknownLabel="Unknown applicant"
          disabled={applicants.length === 0}
        />
      </DataTableToolbarField>

      <DataTableToolbarField
        label="Status"
        htmlFor="filter-status"
        className="w-full sm:w-48"
      >
        <MultiSelect
          id="filter-status"
          options={statusOptions}
          values={params.statuses}
          onValuesChange={(statuses) =>
            void setParams({ statuses, page: null })
          }
          placeholder="All statuses"
          noun="status"
          pluralNoun="statuses"
        />
      </DataTableToolbarField>

      <DataTableToolbarField
        label="Search"
        htmlFor="filter-search"
        className="w-full sm:w-64"
      >
        <div className="relative">
          <Input
            id="filter-search"
            aria-label="Search applications"
            placeholder={
              viewMode === 'drafts'
                ? 'Name, email, or position'
                : 'Name, email, position, or date'
            }
            value={params.q ?? ''}
            onChange={(e) =>
              void setParams(
                { q: e.target.value || null, page: null },
                {
                  history: 'replace',
                  limitUrlUpdates: debounce(FILTER_SEARCH_DEBOUNCE_MS),
                },
              )
            }
            className="w-full pr-12 md:pr-9"
          />
          {params.q && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              onClick={() => void setParams({ q: null, page: null })}
              className="absolute top-1/2 right-1 -translate-y-1/2 md:size-7"
            >
              <ACTION_ICONS.dismiss />
            </Button>
          )}
        </div>
      </DataTableToolbarField>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="w-full sm:w-auto"
        >
          <ACTION_ICONS.clearFilters />
          Clear filters
        </Button>
      )}
    </DataTableToolbar>
  );
}
