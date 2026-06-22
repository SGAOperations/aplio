'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { createPosition } from '@/prisma/actions/position-actions';
import type { PositionStatus } from '@/prisma/client';

import { STATUS_OPTIONS } from '@/lib/constants';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

export function PositionCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PositionStatus>('draft');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next);
      if (!next) {
        setTitle('');
        setDescription('');
        setStatus('draft');
        setOpensAt('');
        setClosesAt('');
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createPosition({
        title,
        description,
        status,
        opensAt: opensAt || undefined,
        closesAt: closesAt || undefined,
      });
      if (result && 'error' in result) {
        toast.error(result.error);
      } else {
        toast.success('Position created');
        router.push(`/positions/${(result as { id: string }).id}/edit`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Position
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Position</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="create-title">Title</Label>
            <Input
              id="create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Position title"
              required
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-description">Description</Label>
            <Textarea
              id="create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Position description"
              rows={4}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PositionStatus)}
              disabled={isPending}
            >
              <SelectTrigger id="create-status">
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
          <div className="grid gap-2">
            <Label htmlFor="create-opens-at">Opens at (optional)</Label>
            <Input
              id="create-opens-at"
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="create-closes-at">Closes at (optional)</Label>
            <Input
              id="create-closes-at"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              disabled={isPending}
            />
          </div>
          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending && <Loader2 className="animate-spin" />}
            Create Position
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
