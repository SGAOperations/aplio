'use client';

import { useState } from 'react';

import { useQueryStates } from 'nuqs';

import { INSIGHTS_RANGE_PRESET_OPTIONS } from '@/lib/constants';
import { insightsSearchParams } from '@/lib/search-params';

import {
  DataTableToolbar,
  DataTableToolbarField,
} from '@/components/ui/data-table-toolbar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InsightsRangeToolbarProps {
  today: string;
}

export function InsightsRangeToolbar({ today }: InsightsRangeToolbarProps) {
  const [params, setParams] = useQueryStates(insightsSearchParams, {
    history: 'push',
    shallow: false,
    scroll: false,
  });
  // Local-only until both dates are valid — never written to the URL as a
  // partial range, so a mid-edit state never produces a broken deep link.
  const [pendingFrom, setPendingFrom] = useState(params.from ?? '');
  const [pendingTo, setPendingTo] = useState(params.to ?? '');

  const isCustom = params.range === 'custom';
  const orderError =
    pendingFrom && pendingTo && pendingTo < pendingFrom
      ? 'End date must be on or after the start date.'
      : null;

  function commitCustomRange(from: string, to: string) {
    if (!from || !to || to < from) return;
    void setParams({ range: 'custom', from, to });
  }

  return (
    <DataTableToolbar>
      <DataTableToolbarField
        label="Date range"
        htmlFor="insights-range"
        className="w-full sm:w-52"
      >
        <Select
          value={params.range}
          onValueChange={(range) => {
            if (range === 'custom') {
              setPendingFrom(params.from ?? today);
              setPendingTo(params.to ?? today);
              commitCustomRange(params.from ?? today, params.to ?? today);
            } else {
              void setParams({
                range:
                  range as (typeof INSIGHTS_RANGE_PRESET_OPTIONS)[number]['value'],
                from: null,
                to: null,
              });
            }
          }}
        >
          <SelectTrigger id="insights-range" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INSIGHTS_RANGE_PRESET_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataTableToolbarField>

      {isCustom && (
        <>
          <DataTableToolbarField
            label="From"
            htmlFor="insights-from"
            className="w-full sm:w-40"
          >
            <Input
              id="insights-from"
              type="date"
              max={today}
              value={pendingFrom}
              onChange={(e) => {
                setPendingFrom(e.target.value);
                commitCustomRange(e.target.value, pendingTo);
              }}
            />
          </DataTableToolbarField>
          <DataTableToolbarField
            label="To"
            htmlFor="insights-to"
            className="w-full sm:w-40"
          >
            <Input
              id="insights-to"
              type="date"
              max={today}
              value={pendingTo}
              onChange={(e) => {
                setPendingTo(e.target.value);
                commitCustomRange(pendingFrom, e.target.value);
              }}
              aria-invalid={!!orderError}
              aria-describedby={orderError ? 'insights-to-error' : undefined}
            />
          </DataTableToolbarField>
          {orderError && (
            <p id="insights-to-error" className="text-destructive text-xs">
              {orderError}
            </p>
          )}
        </>
      )}
    </DataTableToolbar>
  );
}
