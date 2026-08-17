'use client';

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from 'react';
import { useFormContext } from 'react-hook-form';

import {
  Bold,
  Heading,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline,
} from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type PositionFormValues = z.infer<typeof positionFormSchema>;

const COUNTER_THRESHOLD = Math.floor(POSITION_DESCRIPTION_MAX_LENGTH * 0.8);

type ToolbarAction =
  | { kind: 'inline'; before: string; after: string }
  | {
      kind: 'line-prefix';
      prefixFor: (index: number) => string;
      pattern: RegExp;
    }
  | { kind: 'link' };

function applyInlineMarker(
  el: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string,
) {
  const { selectionStart, selectionEnd, value } = el;
  const selected = value.slice(selectionStart, selectionEnd);
  const beforeCtx = value.slice(
    Math.max(0, selectionStart - before.length),
    selectionStart,
  );
  const afterCtx = value.slice(selectionEnd, selectionEnd + after.length);

  if (selected && beforeCtx === before && afterCtx === after) {
    // Toggle off: strip the surrounding markers.
    const start = selectionStart - before.length;
    const end = selectionEnd + after.length;
    el.setRangeText(selected, start, end, 'select');
    return;
  }

  const text = selected || placeholder;
  el.setRangeText(
    `${before}${text}${after}`,
    selectionStart,
    selectionEnd,
    'select',
  );
  const newStart = selectionStart + before.length;
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
    : lines.map((line, i) =>
        pattern.test(line) ? line : `${prefixFor(i)}${line}`,
      );

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

const ORDERED_LIST_PATTERN = /^(\s*)(\d+)([.)])(\s+)(.*)$/;
const UNORDERED_LIST_PATTERN = /^(\s*)([-*+])(\s+)(.*)$/;

/** Continues the list on Enter, or exits it when the current marker is empty. */
function continueList(el: HTMLTextAreaElement): boolean {
  const { selectionStart, selectionEnd, value } = el;
  if (selectionStart !== selectionEnd) return false;

  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const currentLine = value.slice(lineStart, selectionStart);

  const ordered = currentLine.match(ORDERED_LIST_PATTERN);
  const unordered = currentLine.match(UNORDERED_LIST_PATTERN);
  const match = ordered ?? unordered;
  if (!match) return false;

  const indent = match[1];
  const rest = ordered ? ordered[5] : unordered ? unordered[4] : '';

  if (rest.trim() === '') {
    // Empty marker line — remove it and exit the list.
    el.setRangeText(indent, lineStart, selectionStart, 'end');
    return true;
  }

  const nextMarker = ordered
    ? `${indent}${Number(ordered[2]) + 1}${ordered[3]} `
    : `${indent}${unordered ? unordered[2] : ''} `;
  el.setRangeText(`\n${nextMarker}`, selectionStart, selectionStart, 'end');
  return true;
}

const TOOLBAR_ITEMS: {
  label: string;
  icon: typeof Bold;
  action: ToolbarAction;
  shortcut?: { key: string; display: string };
}[] = [
  {
    label: 'Bold',
    icon: Bold,
    action: { kind: 'inline', before: '**', after: '**' },
    shortcut: { key: 'b', display: 'Ctrl+B' },
  },
  {
    label: 'Italic',
    icon: Italic,
    action: { kind: 'inline', before: '_', after: '_' },
    shortcut: { key: 'i', display: 'Ctrl+I' },
  },
  {
    label: 'Underline',
    icon: Underline,
    action: { kind: 'inline', before: '<u>', after: '</u>' },
    shortcut: { key: 'u', display: 'Ctrl+U' },
  },
  {
    label: 'Heading',
    icon: Heading,
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
  {
    label: 'Link',
    icon: Link2,
    action: { kind: 'link' },
    shortcut: { key: 'k', display: 'Ctrl+K' },
  },
];

const PLACEHOLDER_BY_MARKER: Record<string, string> = {
  '**': 'bold',
  _: 'italic',
  '<u>': 'underline',
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
              action.before,
              action.after,
              PLACEHOLDER_BY_MARKER[action.before] ?? 'text',
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

        function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
          const el = textareaRef.current;
          if (!el) return;

          const isModPressed = event.metaKey || event.ctrlKey;
          if (isModPressed) {
            const item = TOOLBAR_ITEMS.find(
              (candidate) =>
                candidate.shortcut?.key === event.key.toLowerCase(),
            );
            if (item) {
              event.preventDefault();
              runAction(item.action);
              return;
            }
          }

          if (event.key === 'Enter' && continueList(el)) {
            event.preventDefault();
            field.onChange(el.value);
          }
        }

        return (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Description</FormLabel>
              <div className="flex items-center gap-2">
                <span
                  className={
                    mode === 'write'
                      ? 'text-foreground text-xs font-medium'
                      : 'text-muted-foreground text-xs'
                  }
                >
                  Write
                </span>
                <Switch
                  checked={mode === 'preview'}
                  onCheckedChange={(checked) =>
                    setMode(checked ? 'preview' : 'write')
                  }
                  disabled={isSubmitting}
                  aria-label="Toggle preview"
                />
                <span
                  className={
                    mode === 'preview'
                      ? 'text-foreground text-xs font-medium'
                      : 'text-muted-foreground text-xs'
                  }
                >
                  Preview
                </span>
              </div>
            </div>

            {mode === 'write' && (
              <TooltipProvider delayDuration={300}>
                <div
                  role="toolbar"
                  aria-label="Formatting"
                  className="flex flex-wrap gap-1"
                >
                  {TOOLBAR_ITEMS.map(
                    ({ label, icon: Icon, action, shortcut }) => (
                      <Tooltip key={label}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={label}
                            disabled={isSubmitting}
                            onClick={() => runAction(action)}
                          >
                            <Icon className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {shortcut ? `${label} (${shortcut.display})` : label}
                        </TooltipContent>
                      </Tooltip>
                    ),
                  )}
                </div>
              </TooltipProvider>
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
                  onKeyDown={handleKeyDown}
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
                <FormDescription className="text-xs">
                  <a
                    href={MARKDOWN_GUIDE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    Use markdown for text formatting
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
