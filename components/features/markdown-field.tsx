'use client';

import { type ClipboardEvent, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Bold, Heading2, Italic, Link2, List, ListOrdered } from 'lucide-react';
import type { z } from 'zod/v4';

import {
  MARKDOWN_GUIDE_URL,
  POSITION_DESCRIPTION_MAX_LENGTH,
  positionFormSchema,
} from '@/lib/constants';
import { markdownToPlainText } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Markdown } from '@/components/ui/markdown';
import { Textarea } from '@/components/ui/textarea';

type PositionFormValues = z.infer<typeof positionFormSchema>;

const COUNTER_THRESHOLD = Math.floor(POSITION_DESCRIPTION_MAX_LENGTH * 0.8);

type ToolbarAction =
  | { kind: 'inline'; marker: string }
  | {
      kind: 'line-prefix';
      prefixFor: (index: number) => string;
      pattern: RegExp;
    }
  | { kind: 'link' };

function applyInlineMarker(
  el: HTMLTextAreaElement,
  marker: string,
  placeholder: string,
) {
  const { selectionStart, selectionEnd, value } = el;
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(
    Math.max(0, selectionStart - marker.length),
    selectionStart,
  );
  const after = value.slice(selectionEnd, selectionEnd + marker.length);

  if (selected && before === marker && after === marker) {
    // Toggle off: strip the surrounding markers.
    const start = selectionStart - marker.length;
    const end = selectionEnd + marker.length;
    el.setRangeText(selected, start, end, 'select');
    return;
  }

  const text = selected || placeholder;
  el.setRangeText(
    `${marker}${text}${marker}`,
    selectionStart,
    selectionEnd,
    'select',
  );
  const newStart = selectionStart + marker.length;
  el.setSelectionRange(newStart, newStart + text.length);
}

function applyLinePrefix(
  el: HTMLTextAreaElement,
  prefixFor: (index: number) => string,
  pattern: RegExp,
) {
  const { selectionStart, selectionEnd, value } = el;
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const nextBreak = value.indexOf('\n', selectionEnd);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');

  const alreadyPrefixed = lines.every((line) => pattern.test(line));

  const nextLines = alreadyPrefixed
    ? lines.map((line) => line.replace(pattern, ''))
    : lines.map((line, i) => `${prefixFor(i)}${line}`);

  const next = nextLines.join('\n');
  el.setRangeText(next, lineStart, lineEnd, 'select');
  el.setSelectionRange(lineStart, lineStart + next.length);
}

function applyLink(el: HTMLTextAreaElement) {
  const { selectionStart, selectionEnd, value } = el;
  const selected = value.slice(selectionStart, selectionEnd);
  const linkText = selected || 'text';
  const url = 'url';
  const next = `[${linkText}](${url})`;
  el.setRangeText(next, selectionStart, selectionEnd, 'select');
  const urlStart = selectionStart + linkText.length + 3;
  el.setSelectionRange(urlStart, urlStart + url.length);
}

const TOOLBAR_ITEMS: {
  label: string;
  icon: typeof Bold;
  action: ToolbarAction;
}[] = [
  { label: 'Bold', icon: Bold, action: { kind: 'inline', marker: '**' } },
  { label: 'Italic', icon: Italic, action: { kind: 'inline', marker: '_' } },
  {
    label: 'Heading',
    icon: Heading2,
    action: { kind: 'line-prefix', prefixFor: () => '## ', pattern: /^## / },
  },
  {
    label: 'Bulleted list',
    icon: List,
    action: { kind: 'line-prefix', prefixFor: () => '- ', pattern: /^- / },
  },
  {
    label: 'Numbered list',
    icon: ListOrdered,
    action: {
      kind: 'line-prefix',
      prefixFor: (index: number) => `${index + 1}. `,
      pattern: /^\d+[.)]\s/,
    },
  },
  { label: 'Link', icon: Link2, action: { kind: 'link' } },
];

const PLACEHOLDER_BY_MARKER: Record<string, string> = {
  '**': 'bold',
  _: 'italic',
};

function isPastableUrl(text: string): boolean {
  if (!URL.canParse(text)) return false;
  const protocol = new URL(text).protocol;
  return protocol === 'http:' || protocol === 'https:';
}

export function MarkdownField() {
  const { control, formState } = useFormContext<PositionFormValues>();
  const isSubmitting = formState.isSubmitting;
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <FormField
      control={control}
      name="description"
      render={({ field }) => {
        function runAction(action: ToolbarAction) {
          const el = textareaRef.current;
          if (!el) return;

          if (action.kind === 'inline')
            applyInlineMarker(
              el,
              action.marker,
              PLACEHOLDER_BY_MARKER[action.marker] ?? 'text',
            );
          else if (action.kind === 'line-prefix')
            applyLinePrefix(el, action.prefixFor, action.pattern);
          else applyLink(el);

          field.onChange(el.value);
          el.focus();
        }

        function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
          const el = textareaRef.current;
          if (!el) return;

          const { selectionStart, selectionEnd } = el;
          if (selectionStart === selectionEnd) return;

          const pasted = event.clipboardData.getData('text/plain').trim();
          const selected = el.value.slice(selectionStart, selectionEnd);
          if (!isPastableUrl(pasted) || isPastableUrl(selected)) return;

          event.preventDefault();
          const next = `[${selected}](${pasted})`;
          el.setRangeText(next, selectionStart, selectionEnd, 'end');
          field.onChange(el.value);
        }

        return (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Description</FormLabel>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={mode === 'write'}
                  disabled={isSubmitting}
                  onClick={() => setMode('write')}
                >
                  Write
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={mode === 'preview'}
                  disabled={isSubmitting}
                  onClick={() => setMode('preview')}
                >
                  Preview
                </Button>
              </div>
            </div>

            {mode === 'write' && (
              <div
                role="toolbar"
                aria-label="Formatting"
                className="flex flex-wrap gap-1"
              >
                {TOOLBAR_ITEMS.map(({ label, icon: Icon, action }) => (
                  <Button
                    key={label}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={label}
                    disabled={isSubmitting}
                    onClick={() => runAction(action)}
                  >
                    <Icon className="size-4" />
                  </Button>
                ))}
              </div>
            )}

            {mode === 'write' ? (
              <FormControl>
                <Textarea
                  {...field}
                  ref={(el) => {
                    field.ref(el);
                    textareaRef.current = el;
                  }}
                  onPaste={handlePaste}
                  rows={10}
                  disabled={isSubmitting}
                  placeholder="Describe the role, responsibilities, and what you're looking for. Markdown is supported."
                />
              </FormControl>
            ) : (
              <div className="border-border min-h-[16rem] rounded-lg border p-3">
                {markdownToPlainText(field.value) ? (
                  <Markdown variant="full" source={field.value} />
                ) : (
                  <p className="text-muted-foreground text-sm italic">
                    Nothing to preview yet.
                  </p>
                )}
              </div>
            )}

            {mode === 'write' && (
              <div className="flex items-center justify-between gap-2">
                <FormDescription>
                  Markdown is supported — <strong>bold</strong>, headings,
                  lists, and links.{' '}
                  <a
                    href={MARKDOWN_GUIDE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    Formatting guide
                  </a>
                </FormDescription>
                {field.value.length >= COUNTER_THRESHOLD && (
                  <span
                    className={
                      field.value.length > POSITION_DESCRIPTION_MAX_LENGTH
                        ? 'text-destructive text-xs'
                        : 'text-muted-foreground text-xs'
                    }
                  >
                    {field.value.length.toLocaleString()} /{' '}
                    {POSITION_DESCRIPTION_MAX_LENGTH.toLocaleString()}
                  </span>
                )}
              </div>
            )}

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
