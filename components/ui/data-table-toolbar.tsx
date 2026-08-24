import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Label } from '@/components/ui/label';

interface DataTableToolbarProps {
  children: ReactNode;
}

export function DataTableToolbar({ children }: DataTableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {children}
    </div>
  );
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
    <div className={cn('flex w-full flex-col gap-1.5 sm:w-48', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
