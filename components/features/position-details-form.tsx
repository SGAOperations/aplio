'use client';

import { useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import type { PositionStatus } from '@/prisma/client';
import { updatePosition } from '@/prisma/services/position-actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PositionDetailsFormProps {
  position: {
    id: string;
    title: string;
    description: string;
    status: PositionStatus;
    opensAt: string | null;
    closesAt: string | null;
  };
}

const STATUS_OPTIONS: { value: PositionStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

export function PositionDetailsForm({ position }: PositionDetailsFormProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const status = formData.get('status') as PositionStatus;
    const opensAt = formData.get('opensAt') as string;
    const closesAt = formData.get('closesAt') as string;

    startTransition(async () => {
      const result = await updatePosition({
        id: position.id,
        title,
        description,
        status,
        opensAt: opensAt || undefined,
        closesAt: closesAt || undefined,
      });

      if (result.ok) {
        toast.success('Position updated');
      } else {
        toast.error(result.error);
      }
    });
  }

  const formatDateForInput = (iso: string | null) => {
    if (!iso) return '';
    return iso.slice(0, 16);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={position.title}
          required
          disabled={isPending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={position.description}
          rows={4}
          disabled={isPending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={position.status}
          disabled={isPending}
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="opensAt">Opens At</Label>
          <Input
            id="opensAt"
            name="opensAt"
            type="datetime-local"
            defaultValue={formatDateForInput(position.opensAt)}
            disabled={isPending}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="closesAt">Closes At</Label>
          <Input
            id="closesAt"
            name="closesAt"
            type="datetime-local"
            defaultValue={formatDateForInput(position.closesAt)}
            disabled={isPending}
          />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
