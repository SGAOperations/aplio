'use client';

import type { AnswerQuestion, QuestionFileTarget } from '@/lib/types';
import { useAnswerAutosave } from '@/lib/use-answer-autosave';
import { answerFieldIds } from '@/lib/utils';

import { AnswerCard } from '@/components/features/answer-card';
import { AnswerField } from '@/components/features/answer-field';

interface AnswerEditorField {
  value: string[];
  onChange: (value: string[]) => void;
  onBlur: () => void;
}

interface AnswerEditorProps {
  question: AnswerQuestion;
  field: AnswerEditorField;
  error?: string;
  onSave: (value: string[]) => Promise<void>;
  onSaved?: (value: string[]) => void;
  fileTarget: QuestionFileTarget;
}

// The only editable-answer component: card shell + field controls + autosave lifecycle.
export function AnswerEditor({
  question,
  field,
  error,
  onSave,
  onSaved,
  fileTarget,
}: AnswerEditorProps) {
  const { inputId, errorId, statusId } = answerFieldIds(question.id);
  const {
    status,
    validationError,
    commit,
    handleBlur,
    markDirty,
    markPersisted,
  } = useAnswerAutosave({
    question,
    initialValue: field.value,
    save: onSave,
    onSaved,
  });

  const message = error ?? validationError;
  const htmlFor =
    question.type === 'short_answer' || question.type === 'long_answer'
      ? inputId
      : undefined;

  return (
    <AnswerCard
      question={question}
      htmlFor={htmlFor}
      invalid={!!error}
      footer={
        <>
          {message && (
            <p id={errorId} className="text-destructive mt-2 text-xs">
              {message}
            </p>
          )}
          <p
            id={statusId}
            aria-live="polite"
            className="text-muted-foreground mt-2 block text-xs"
          >
            {status === 'saving' && 'Saving…'}
            {status === 'saved' && 'Saved'}
            {status === 'error' && 'Failed to save. Please try again.'}
          </p>
        </>
      }
    >
      <AnswerField
        question={question}
        value={field.value}
        onChange={(value) => {
          field.onChange(value);
          markDirty();
        }}
        onCommit={(value) => {
          field.onChange(value);
          commit(value);
        }}
        onBlur={(value) => {
          field.onBlur();
          handleBlur(value);
        }}
        onFilePersisted={(value) => {
          field.onChange(value);
          markPersisted(value);
        }}
        fileTarget={fileTarget}
        invalid={!!message}
        describedBy={message ? errorId : undefined}
      />
    </AnswerCard>
  );
}
