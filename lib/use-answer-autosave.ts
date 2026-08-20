'use client';

import { useCallback, useRef, useState } from 'react';

import { toast } from 'sonner';

import { getAnswerBlurError } from '@/lib/constants';
import type { AnswerQuestion } from '@/lib/types';
import { ActionError } from '@/lib/utils';

export type AnswerSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAnswerAutosaveOptions {
  question: AnswerQuestion;
  initialValue: string[];
  save: (value: string[]) => Promise<void>;
  onSaved?: (value: string[]) => void;
}

interface UseAnswerAutosaveResult {
  status: AnswerSaveStatus;
  validationError: string | null;
  commit: (value: string[]) => void;
  handleBlur: (value: string[]) => void;
  markDirty: () => void;
  markPersisted: (value: string[]) => void;
}

export function useAnswerAutosave({
  question,
  initialValue,
  save,
  onSaved,
}: UseAnswerAutosaveOptions): UseAnswerAutosaveResult {
  // Raw value, never re-seeded — an untouched blur must write nothing.
  const savedValueRef = useRef(JSON.stringify(initialValue));
  const [status, setStatus] = useState<AnswerSaveStatus>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  const markDirty = useCallback(() => {
    setStatus('idle');
    setValidationError(null);
  }, []);

  const markPersisted = useCallback((value: string[]) => {
    savedValueRef.current = JSON.stringify(value);
    setStatus('saved');
  }, []);

  const commit = useCallback(
    (value: string[]) => {
      const blurError = getAnswerBlurError(question, value);
      if (blurError) {
        setValidationError(blurError);
        return;
      }
      setValidationError(null);

      const serialized = JSON.stringify(value);
      if (serialized === savedValueRef.current) return;

      setStatus('saving');
      save(value)
        .then(() => {
          savedValueRef.current = serialized;
          setStatus('saved');
          onSaved?.(value);
        })
        .catch((err: unknown) => {
          // savedValueRef is not advanced on failure so a retry re-sends.
          setStatus('error');
          toast.error(
            err instanceof ActionError ? err.message : 'Failed to save answer',
          );
        });
    },
    [question, save, onSaved],
  );

  return {
    status,
    validationError,
    commit,
    handleBlur: commit,
    markDirty,
    markPersisted,
  };
}
