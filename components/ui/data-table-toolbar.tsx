import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const WRAPPER_CLASS =
  'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end';
const FIELD_CLASS = 'flex w-full flex-col gap-1.5 sm:w-48';

interface DataTableToolbarProps {
  children: ReactNode;
}

export function DataTableToolbar({ children }: DataTableToolbarProps) {
  return <div className={WRAPPER_CLASS}>{children}</div>;
}

interface DataTableToolbarFieldProps {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}

export function DataTableToolbarField({
  label,
  htmlFor,
  className,
  children,
}: DataTableToolbarFieldProps) {
  return (
    <div className={cn(FIELD_CLASS, className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

interface DataTableToolbarSkeletonProps {
  // Per-field width utility, e.g. 'sm:w-48' — mirrors DataTableToolbarField's className.
  fields: string[];
  hasTrailingCount?: boolean;
}

export function DataTableToolbarSkeleton({
  fields,
  hasTrailingCount = false,
}: DataTableToolbarSkeletonProps) {
  return (
    <div className={WRAPPER_CLASS}>
      {fields.map((widthClass, i) => (
        <div key={i} className={cn(FIELD_CLASS, widthClass)}>
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-11 w-full md:h-9" />
        </div>
      ))}
      {hasTrailingCount && (
        <Skeleton className="h-5 w-48 sm:ml-auto sm:self-end" />
      )}
    </div>
  );
}
