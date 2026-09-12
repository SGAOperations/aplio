'use client';

import { useCallback, useRef, useState } from 'react';

import { ActionError } from '@/lib/utils';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions<T> {
  initialValue: T;
  save: (value: T) => Promise<void>;
}

interface UseAutosaveResult<T> {
  status: AutosaveStatus;
  error: string | null;
  commit: (value: T) => void;
  setSaved: (value: T) => void;
}

// Serializes writes through a per-instance promise chain so a fast second commit can't outrace the first.
export function useAutosave<T>({
  initialValue,
  save,
}: UseAutosaveOptions<T>): UseAutosaveResult<T> {
  const savedValueRef = useRef(JSON.stringify(initialValue));
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const setSaved = useCallback((value: T) => {
    savedValueRef.current = JSON.stringify(value);
    setStatus('saved');
    setError(null);
  }, []);

  const commit = useCallback(
    (value: T) => {
      const serialized = JSON.stringify(value);
      if (serialized === savedValueRef.current) return;

      setStatus('saving');
      setError(null);
      chainRef.current = chainRef.current
        .then(() => save(value))
        .then(() => {
          savedValueRef.current = serialized;
          setStatus('saved');
        })
        .catch((err: unknown) => {
          setStatus('error');
          setError(
            err instanceof ActionError
              ? err.message
              : 'Something went wrong. Please try again.',
          );
        });
    },
    [save],
  );

  return { status, error, commit, setSaved };
}

// Shared inline-status copy for every autosaved field (rendered inside its
// FormDescription so the aria-live/aria-describedby wiring stays free).
export function autosaveStatusText(
  status: AutosaveStatus,
  error: string | null,
): string | null {
  switch (status) {
    case 'idle':
      return null;
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'error':
      return error ?? 'Something went wrong. Please try again.';
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}
