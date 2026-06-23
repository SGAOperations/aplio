'use client';

import { useTransition } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { updatePosition } from '@/prisma/actions/position-actions';
import type { PositionStatus } from '@/prisma/client';

import { STATUS_OPTIONS } from '@/lib/constants';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

      if (result && 'error' in result) {
        toast.error(result.error);
      } else {
        toast.success('Position updated');
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
        <Select
          defaultValue={position.status}
          name="status"
          disabled={isPending}
        >
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
