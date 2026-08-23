'use client';

import { useState } from 'react';

import {
  ANSWER_LONG_MAX_LENGTH,
  ANSWER_OTHER_MAX_LENGTH,
  ANSWER_SHORT_MAX_LENGTH,
  FORMAT_INPUT_TYPES,
  OTHER_OPTION_LABEL,
  OTHER_OPTION_VALUE,
} from '@/lib/constants';
import type { AnswerQuestion, QuestionFileTarget } from '@/lib/types';
import {
  answerFieldIds,
  cn,
  composeDescribedBy,
  partitionAnswerValue,
  splitOtherAnswer,
} from '@/lib/utils';

import { AnswerMismatchNotice } from '@/components/features/answer-mismatch-notice';
import { QuestionFileField } from '@/components/features/question-file-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface AnswerFieldProps {
  question: AnswerQuestion;
  value: string[];
  onChange: (value: string[]) => void;
  onCommit: (value: string[]) => void;
  onBlur: (value: string[]) => void;
  onFilePersisted: (value: string[]) => void;
  fileTarget: QuestionFileTarget;
  invalid?: boolean;
  describedBy?: string;
}

const CHOICE_ROW_CLASS =
  'flex cursor-pointer items-center gap-2 py-2.5 sm:py-1';

// Every editable answer type, Radix-only, sharing one autosave/notice/a11y wiring.
export function AnswerField({
  question,
  value,
  onChange,
  onCommit,
  onBlur,
  onFilePersisted,
  fileTarget,
  invalid,
  describedBy,
}: AnswerFieldProps) {
  const { labelId, inputId, noticeId } = answerFieldIds(question.id);
  const { fitted, orphaned } = partitionAnswerValue(question, value);
  const { selectedOptions, otherText: fittedOtherText } = splitOtherAnswer(
    question,
    fitted,
  );

  // Gated on allowOther — a turned-off option can't masquerade as "Other".
  const [otherSelected, setOtherSelected] = useState(
    question.allowOther && fittedOtherText !== '',
  );
  const [otherText, setOtherText] = useState(fittedOtherText);

  // Resyncs when `value` changes out from under us without a remount (e.g.
  // the stepper's "Use profile answers" revert calling setValue directly).
  const [prevFittedOtherText, setPrevFittedOtherText] =
    useState(fittedOtherText);
  if (fittedOtherText !== prevFittedOtherText) {
    setPrevFittedOtherText(fittedOtherText);
    setOtherSelected(question.allowOther && fittedOtherText !== '');
    setOtherText(fittedOtherText);
  }

  const notice = orphaned.length > 0 && (
    <AnswerMismatchNotice
      id={noticeId}
      values={orphaned}
      questionType={question.type}
    />
  );

  const combinedDescribedBy = composeDescribedBy(
    orphaned.length > 0 && noticeId,
    describedBy,
  );

  if (question.type === 'short_answer')
    return (
      <>
        {notice}
        <Input
          id={inputId}
          type={question.format ? FORMAT_INPUT_TYPES[question.format] : 'text'}
          value={fitted[0] ?? ''}
          onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
          onBlur={() => onBlur(value)}
          maxLength={ANSWER_SHORT_MAX_LENGTH}
          aria-required={question.required}
          aria-invalid={invalid}
          aria-describedby={combinedDescribedBy}
        />
      </>
    );

  if (question.type === 'long_answer') {
    const countId = `${question.id}-long-answer-count`;
    return (
      <>
        {notice}
        <Textarea
          id={inputId}
          value={fitted[0] ?? ''}
          onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
          onBlur={() => onBlur(value)}
          className="min-h-[120px]"
          maxLength={ANSWER_LONG_MAX_LENGTH}
          aria-required={question.required}
          aria-invalid={invalid}
          aria-describedby={composeDescribedBy(combinedDescribedBy, countId)}
        />
        <p
          id={countId}
          className={cn(
            'text-muted-foreground mt-1 text-right text-xs',
            (fitted[0]?.length ?? 0) >= ANSWER_LONG_MAX_LENGTH &&
              'text-destructive',
          )}
        >
          {(fitted[0]?.length ?? 0).toLocaleString()}/
          {ANSWER_LONG_MAX_LENGTH.toLocaleString()}
        </p>
      </>
    );
  }

  if (question.type === 'single_choice')
    return (
      <div className="flex flex-col gap-2">
        {notice}
        <RadioGroup
          aria-labelledby={labelId}
          aria-required={question.required}
          aria-invalid={invalid}
          aria-describedby={combinedDescribedBy}
          value={
            otherSelected ? OTHER_OPTION_VALUE : (selectedOptions[0] ?? '')
          }
          onValueChange={(v) => {
            if (v === OTHER_OPTION_VALUE) {
              setOtherSelected(true);
              const next = otherText ? [otherText] : [];
              onChange(next);
              onCommit(next);
              return;
            }
            // Clearing the typed text stops it being silently resubmitted.
            setOtherSelected(false);
            setOtherText('');
            onChange([v]);
            onCommit([v]);
          }}
        >
          {question.options.map((option, i) => (
            <div key={option} className={CHOICE_ROW_CLASS}>
              <RadioGroupItem value={option} id={`${question.id}-${i}`} />
              <Label
                htmlFor={`${question.id}-${i}`}
                className="cursor-pointer text-sm font-normal"
              >
                {option}
              </Label>
            </div>
          ))}

          {question.allowOther && (
            <div className={CHOICE_ROW_CLASS}>
              <RadioGroupItem
                value={OTHER_OPTION_VALUE}
                id={`${question.id}-other`}
              />
              <Label
                htmlFor={`${question.id}-other`}
                className="cursor-pointer text-sm font-normal"
              >
                {OTHER_OPTION_LABEL}
              </Label>
            </div>
          )}
        </RadioGroup>

        {question.allowOther && otherSelected && (
          <div className="ml-6 flex flex-col gap-1">
            <Label
              id={`${question.id}-other-label`}
              htmlFor={`${question.id}-other-text`}
              className="text-muted-foreground text-xs font-normal"
            >
              {OTHER_OPTION_LABEL}
              {question.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Input
              id={`${question.id}-other-text`}
              value={otherText}
              onChange={(e) => {
                setOtherText(e.target.value);
                onChange(e.target.value ? [e.target.value] : []);
              }}
              onBlur={() => onBlur(value)}
              aria-labelledby={`${labelId} ${question.id}-other-label`}
              maxLength={ANSWER_OTHER_MAX_LENGTH}
            />
          </div>
        )}
      </div>
    );

  if (question.type === 'multiple_choice')
    return (
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={combinedDescribedBy}
        className="flex flex-col gap-2"
      >
        {notice}
        {question.options.map((option, i) => (
          <div key={option} className={CHOICE_ROW_CLASS}>
            <Checkbox
              id={`${question.id}-${i}`}
              checked={selectedOptions.includes(option)}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selectedOptions, option]
                  : selectedOptions.filter((v) => v !== option);
                const withOther =
                  otherSelected && otherText ? [...next, otherText] : next;
                onChange(withOther);
                onCommit(withOther);
              }}
            />
            <Label
              htmlFor={`${question.id}-${i}`}
              className="cursor-pointer text-sm font-normal"
            >
              {option}
            </Label>
          </div>
        ))}

        {question.allowOther && (
          <div className={CHOICE_ROW_CLASS}>
            <Checkbox
              id={`${question.id}-other`}
              checked={otherSelected}
              onCheckedChange={(checked) => {
                setOtherSelected(!!checked);
                if (checked) {
                  const next = otherText
                    ? [...selectedOptions, otherText]
                    : selectedOptions;
                  onChange(next);
                  onCommit(next);
                } else {
                  // Drops the typed text immediately, so it isn't resubmitted.
                  setOtherText('');
                  onChange(selectedOptions);
                  onCommit(selectedOptions);
                }
              }}
            />
            <Label
              htmlFor={`${question.id}-other`}
              className="cursor-pointer text-sm font-normal"
            >
              {OTHER_OPTION_LABEL}
            </Label>
          </div>
        )}

        {question.allowOther && otherSelected && (
          <div className="ml-6 flex flex-col gap-1">
            <Label
              id={`${question.id}-other-label`}
              htmlFor={`${question.id}-other-text`}
              className="text-muted-foreground text-xs font-normal"
            >
              {OTHER_OPTION_LABEL}
              {question.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Input
              id={`${question.id}-other-text`}
              value={otherText}
              onChange={(e) => {
                setOtherText(e.target.value);
                onChange(
                  e.target.value
                    ? [...selectedOptions, e.target.value]
                    : selectedOptions,
                );
              }}
              onBlur={() => onBlur(value)}
              aria-labelledby={`${labelId} ${question.id}-other-label`}
              maxLength={ANSWER_OTHER_MAX_LENGTH}
            />
          </div>
        )}
      </div>
    );

  // question.type === 'file_upload'
  return (
    <>
      {notice}
      <QuestionFileField
        target={fileTarget}
        value={fitted}
        onChange={onFilePersisted}
        labelledBy={labelId}
      />
    </>
  );
}
