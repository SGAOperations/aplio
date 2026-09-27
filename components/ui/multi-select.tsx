'use client';

import { type ReactNode, useMemo, useState } from 'react';

import { FILTER_SELECT_MAX_VISIBLE } from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import { cn, formatMultiSelectSummary } from '@/lib/utils';

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface MultiSelectOption<T extends string = string> {
  value: T;
  label: string;
  // Status dots and similar decorative markers — rendered as given, never a
  // LucideIcon prop (lib/icons.ts's own rule: look icons up where they render).
  icon?: ReactNode;
}

interface MultiSelectProps<T extends string> {
  id: string;
  options: MultiSelectOption<T>[];
  values: T[];
  onValuesChange: (values: T[]) => void;
  placeholder: string;
  noun: string;
  pluralNoun?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Label for a selected value absent from `options` — a stale/foreign deep link. */
  unknownLabel?: string;
  disabled?: boolean;
  className?: string;
}

// Mirrors SelectTrigger's class string (components/ui/select.tsx) — shadcn
// output has no exported trigger class to reuse.
const TRIGGER_CLASS =
  "border-input data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex min-h-11 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-base whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 md:min-h-0 md:text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-sm border',
        selected
          ? 'bg-primary border-primary text-primary-foreground'
          : 'border-input',
      )}
    >
      {selected && <ACTION_ICONS.selected className="size-3" />}
    </span>
  );
}

/**
 * Shared multi-select filter dropdown (Popover + Command). Covers
 * single-selection-with-search call sites too — pick one option and the
 * trigger just reads that option's label.
 */
export function MultiSelect<T extends string = string>({
  id,
  options,
  values,
  onValuesChange,
  placeholder,
  noun,
  pluralNoun,
  searchable = false,
  searchPlaceholder,
  emptyMessage,
  unknownLabel,
  disabled = false,
  className,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const plural = pluralNoun ?? `${noun}s`;

  // A stale/foreign deep link — synthesized as a leading item so it stays
  // visible and removable instead of vanishing behind the placeholder.
  const unknownValues = useMemo(
    () => values.filter((v) => !options.some((o) => o.value === v)),
    [values, options],
  );

  const visibleOptions = options.slice(0, FILTER_SELECT_MAX_VISIBLE);
  const truncated = options.length > FILTER_SELECT_MAX_VISIBLE;

  function toggle(value: T) {
    onValuesChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    );
  }

  const summary = formatMultiSelectSummary({
    values,
    options,
    unknownLabel,
    placeholder,
    noun,
    pluralNoun,
  });

  const listId = `${id}-listbox`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          disabled={disabled}
          data-placeholder={values.length === 0 ? '' : undefined}
          data-size="default"
          className={cn(TRIGGER_CLASS, className)}
        >
          <span className="line-clamp-1 flex items-center gap-2">
            {summary}
          </span>
          <ACTION_ICONS.expand className="size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        id={listId}
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          {searchable && (
            <CommandInput
              placeholder={searchPlaceholder ?? `Search ${plural}…`}
            />
          )}
          <CommandList aria-multiselectable="true" className="max-h-72">
            <CommandEmpty>{emptyMessage ?? `No ${plural} found.`}</CommandEmpty>
            {unknownValues.map((value) => (
              <CommandItem
                key={value}
                value={value}
                forceMount
                aria-checked
                className="min-h-11 md:min-h-9"
                onSelect={() => toggle(value)}
              >
                <SelectionMark selected />
                {unknownLabel ?? value}
              </CommandItem>
            ))}
            {visibleOptions.map((option) => {
              const selected = values.includes(option.value);
              return (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  aria-checked={selected}
                  className="min-h-11 md:min-h-9"
                  onSelect={() => toggle(option.value)}
                >
                  <SelectionMark selected={selected} />
                  {option.icon}
                  {option.label}
                </CommandItem>
              );
            })}
            {truncated && (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                Showing the first {FILTER_SELECT_MAX_VISIBLE} — keep typing to
                narrow.
              </div>
            )}
            {values.length > 0 && (
              <>
                <CommandSeparator alwaysRender />
                <CommandItem
                  forceMount
                  className="text-muted-foreground min-h-11 md:min-h-9"
                  onSelect={() => onValuesChange([])}
                >
                  Clear selection
                </CommandItem>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
