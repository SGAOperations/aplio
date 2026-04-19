'use client';

import { useState, useTransition } from 'react';

import { QuestionType } from '@/prisma/client';
import { upsertGlobalAnswer } from '@/prisma/services/global-answer-actions';

interface ProfileQuestionProps {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  value: string[];
}

export function ProfileQuestion({
  id,
  label,
  type,
  required,
  options,
  value: initialValue,
}: ProfileQuestionProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  function save(newValue: string[]) {
    setValue(newValue);
    setIsEditing(false);
    startTransition(async () => {
      await upsertGlobalAnswer(id, newValue);
    });
  }

  const isEmpty = value.length === 0 || (value.length === 1 && value[0] === '');
  const displayValue = isEmpty ? (
    <span className="text-muted-foreground italic">Not answered</span>
  ) : (
    <span>{value.join(', ')}</span>
  );

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </span>
        {isPending && (
          <span className="text-muted-foreground text-xs">Saving…</span>
        )}
      </div>

      {isEditing ? (
        <QuestionInput
          type={type}
          options={options}
          value={value}
          onSave={save}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="hover:bg-muted w-full rounded px-2 py-1 text-left text-sm transition-colors"
        >
          {displayValue}
        </button>
      )}
    </div>
  );
}

interface QuestionInputProps {
  type: QuestionType;
  options: string[];
  value: string[];
  onSave: (value: string[]) => void;
  onCancel: () => void;
}

function QuestionInput({
  type,
  options,
  value,
  onSave,
  onCancel,
}: QuestionInputProps) {
  const [draft, setDraft] = useState(value);

  if (type === 'short_answer')
    return (
      <input
        autoFocus
        className="border-input w-full rounded border px-2 py-1 text-sm"
        defaultValue={draft[0] ?? ''}
        onBlur={(e) => onSave([e.target.value])}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave([e.currentTarget.value]);
          if (e.key === 'Escape') onCancel();
        }}
      />
    );

  if (type === 'long_answer')
    return (
      <textarea
        autoFocus
        className="border-input w-full rounded border px-2 py-1 text-sm"
        rows={4}
        defaultValue={draft[0] ?? ''}
        onBlur={(e) => onSave([e.target.value])}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      />
    );

  if (type === 'single_choice')
    return (
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`q-${opt}`}
              value={opt}
              defaultChecked={draft[0] === opt}
              onChange={() => setDraft([opt])}
            />
            {opt}
          </label>
        ))}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="bg-primary text-primary-foreground rounded px-3 py-1 text-xs"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            value={opt}
            defaultChecked={draft.includes(opt)}
            onChange={(e) =>
              setDraft((prev) =>
                e.target.checked
                  ? [...prev, opt]
                  : prev.filter((v) => v !== opt),
              )
            }
          />
          {opt}
        </label>
      ))}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="bg-primary text-primary-foreground rounded px-3 py-1 text-xs"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
