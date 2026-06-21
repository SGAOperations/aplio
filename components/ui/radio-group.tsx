'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

function RadioGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="radiogroup"
      data-slot="radio-group"
      className={cn('grid gap-3', className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  checked,
  onChange,
  value,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <input
      type="radio"
      data-slot="radio-group-item"
      value={value}
      checked={checked}
      onChange={onChange}
      className={cn('accent-primary size-4', className)}
      {...props}
    />
  );
}

export { RadioGroup, RadioGroupItem };
