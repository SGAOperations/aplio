import type { ReactNode } from 'react';

interface InsightSectionProps {
  slug: string;
  title: string;
  note?: string;
  children: ReactNode;
}

/** Section shell: gives the sidebar in-page sub-nav for free (`docs/DESIGN.md` §5). */
export function InsightSection({
  slug,
  title,
  note,
  children,
}: InsightSectionProps) {
  const headingId = `insights-${slug}-heading`;
  return (
    <section
      id={`insights-${slug}`}
      data-section-nav={title}
      aria-labelledby={headingId}
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <div>
        <h2 id={headingId} className="text-lg font-semibold">
          {title}
        </h2>
        {note && <p className="text-muted-foreground text-xs">{note}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

/** Layout-only twin for `loading.tsx` — no `data-section-nav` (nothing to jump to yet). */
export function InsightSectionSkeleton({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-hidden className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}
