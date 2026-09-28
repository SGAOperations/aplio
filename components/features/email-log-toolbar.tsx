'use client';

import { useMemo } from 'react';

import { debounce, useQueryStates } from 'nuqs';

import {
  EMAIL_STATUS_OPTIONS,
  EMAIL_TEMPLATE_OPTIONS,
  FILTER_SEARCH_DEBOUNCE_MS,
} from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import { emailLogSearchParams, emailLogUrlKeys } from '@/lib/search-params';

import { EmailStatusDot } from '@/components/features/status-badge';
import { Button } from '@/components/ui/button';
import {
  DataTableToolbar,
  DataTableToolbarField,
} from '@/components/ui/data-table-toolbar';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';

interface EmailLogToolbarProps {
  hasActiveFilters: boolean;
}

export function EmailLogToolbar({ hasActiveFilters }: EmailLogToolbarProps) {
  const [params, setParams] = useQueryStates(emailLogSearchParams, {
    urlKeys: emailLogUrlKeys,
    history: 'push',
    shallow: false,
    scroll: false,
  });

  const statusOptions = useMemo(
    () =>
      EMAIL_STATUS_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        icon: <EmailStatusDot status={opt.value} />,
      })),
    [],
  );

  const templateOptions = useMemo(
    () =>
      EMAIL_TEMPLATE_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
      })),
    [],
  );

  function clearFilters() {
    void setParams(null);
  }

  return (
    <DataTableToolbar>
      <DataTableToolbarField
        label="Status"
        htmlFor="filter-status"
        className="w-full sm:w-44"
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
        label="Template"
        htmlFor="filter-template"
        className="w-full sm:w-52"
      >
        <MultiSelect
          id="filter-template"
          options={templateOptions}
          values={params.templates}
          onValuesChange={(templates) =>
            void setParams({ templates, page: null })
          }
          placeholder="All templates"
          noun="template"
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
            aria-label="Search emails by recipient"
            placeholder="Search by recipient address"
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
