import type { ReactNode } from 'react';

interface PositionsScopeSectionProps {
  id: string;
  title: string;
  count: number;
  children: ReactNode;
  inNav?: boolean;
}

export function PositionsScopeSection({
  id,
  title,
  count,
  children,
  inNav = true,
}: PositionsScopeSectionProps) {
  return (
    <section
      id={id}
      {...(inNav && { 'data-section-nav': title })}
      aria-labelledby={`${id}-heading`}
      className="flex scroll-mt-6 flex-col gap-4"
    >
      <h2
        id={`${id}-heading`}
        className="border-border flex items-baseline gap-2 border-b pb-2 text-lg font-semibold"
      >
        {title}
        <span className="text-muted-foreground text-sm font-normal">
          ({count})
        </span>
      </h2>
      {children}
    </section>
  );
}
