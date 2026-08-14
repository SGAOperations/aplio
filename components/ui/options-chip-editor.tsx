'use client';

import { useId } from 'react';

import { CornerDownLeft } from 'lucide-react';

import { Input } from '@/components/ui/input';

interface OptionsChipEditorProps {
  options: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

// Library-agnostic "type and Enter" chip editor: works under RHF or plain useState.
export function OptionsChipEditor({
  options,
  onChange,
  disabled,
}: OptionsChipEditorProps) {
  // Own id: Slot merges FormControl's aria-describedby onto the outer div, not this Input.
  const hintId = useId();

  function addOption(value: string) {
    const trimmed = value.trim();
    if (!trimmed || options.includes(trimmed)) return;
    onChange([...options, trimmed]);
  }

  function removeOption(option: string) {
    onChange(options.filter((o) => o !== option));
  }

  return (
    <div className="flex flex-col gap-2">
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {options.map((option) => (
            <span
              key={option}
              className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            >
              {option}
              <button
                type="button"
                onClick={() => removeOption(option)}
                disabled={disabled}
                className="hover:text-destructive ml-0.5 disabled:cursor-not-allowed"
                aria-label={`Remove ${option}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          placeholder="Type an option and press Enter"
          disabled={disabled}
          aria-describedby={hintId}
          className="pr-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addOption(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
        />
        <CornerDownLeft
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2"
        />
      </div>
      <span id={hintId} className="sr-only">
        Press Enter to add an option
      </span>
    </div>
  );
}
