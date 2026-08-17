import ReactMarkdown, { type Components } from 'react-markdown';

import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

// rehypeRaw parses raw HTML (needed for <u> — markdown has no native underline
// syntax); allowedElements below still acts as the allowlist, so any other raw
// tag (e.g. <script>) is dropped rather than rendered.
const FULL_ALLOWED_ELEMENTS = [
  'p',
  'br',
  'hr',
  'strong',
  'em',
  'u',
  'del',
  'a',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'code',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

const COMPACT_ALLOWED_ELEMENTS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  'del',
  'a',
  'code',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
];

// Real anchors on every surface — `nofollow` keeps admin-authored links off the SEO surface.
const linkComponent: Components['a'] = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer nofollow"
    className="text-primary underline underline-offset-4"
  >
    {children}
  </a>
);

const fullComponents: Components = {
  a: linkComponent,
  u: ({ children }) => <u className="underline">{children}</u>,
  h2: ({ children }) => (
    <h2 className="text-foreground mt-3 text-base font-medium first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-foreground mt-3 text-sm font-semibold first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-foreground mt-3 text-sm font-semibold first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground mt-3 text-sm leading-relaxed first:mt-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="text-muted-foreground mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="text-muted-foreground mt-3 list-decimal space-y-1 pl-5 text-sm leading-relaxed first:mt-0">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-border text-muted-foreground mt-3 border-l-2 pl-3 italic first:mt-0">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-muted rounded-md px-1 py-0.5 text-sm">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-muted mt-3 overflow-x-auto rounded-md p-3 text-sm first:mt-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-border mt-3" />,
  table: ({ children }) => (
    <div className="mt-3 overflow-x-auto first:mt-0">
      <table className="text-muted-foreground w-full text-left text-sm">
        {children}
      </table>
    </div>
  ),
};

// Headings render as paragraph-styled text so a list of cards never injects
// heading elements into the document outline.
const compactComponents: Components = {
  a: linkComponent,
  u: ({ children }) => <u className="underline">{children}</u>,
  h2: ({ children }) => (
    <p className="text-foreground font-semibold">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="text-foreground font-semibold">{children}</p>
  ),
  h4: ({ children }) => (
    <p className="text-foreground font-semibold">{children}</p>
  ),
  p: ({ children }) => <p className="mt-1 first:mt-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="marker:text-muted-foreground/70 mt-1 list-disc space-y-0.5 pl-4 first:mt-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="marker:text-muted-foreground/70 mt-1 list-decimal space-y-0.5 pl-4 first:mt-0">
      {children}
    </ol>
  ),
  code: ({ children }) => (
    <code className="bg-muted rounded px-1">{children}</code>
  ),
};

interface MarkdownProps {
  source: string;
  variant: 'full' | 'compact';
  className?: string;
}

export function Markdown({ source, variant, className }: MarkdownProps) {
  const isFull = variant === 'full';

  return (
    <div
      className={cn(isFull ? undefined : 'text-muted-foreground', className)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        allowedElements={
          isFull ? FULL_ALLOWED_ELEMENTS : COMPACT_ALLOWED_ELEMENTS
        }
        components={isFull ? fullComponents : compactComponents}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
