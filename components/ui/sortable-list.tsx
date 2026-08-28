'use client';

import type { ReactNode } from 'react';
import { useMemo, useOptimistic, useTransition } from 'react';

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

import { ACTION_ICONS } from '@/lib/icons';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';

interface SortableProviderProps<T> {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  onReorder: (ids: string[]) => void;
  children: ReactNode;
}

export function SortableProvider<T>({
  items,
  getId,
  getLabel,
  onReorder,
  children,
}: SortableProviderProps<T>) {
  const ids = useMemo(() => items.map(getId), [items, getId]);
  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(getId(item), getLabel(item));
    return map;
  }, [items, getId, getLabel]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Simulates the drop so the announced position matches what the pointer/keyboard preview shows.
  function describePosition(activeId: string, overId: string | null) {
    const activeIndex = ids.indexOf(activeId);
    const label = labelById.get(activeId) ?? '';
    if (activeIndex === -1) return { label, index: 0, total: ids.length };
    const overIndex = overId ? ids.indexOf(overId) : -1;
    const next =
      overIndex === -1 ? ids : arrayMove(ids, activeIndex, overIndex);
    return { label, index: next.indexOf(activeId) + 1, total: next.length };
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      const { label, index, total } = describePosition(String(active.id), null);
      return `Picked up "${label}". Position ${index} of ${total}.`;
    },
    onDragOver({ active, over }) {
      const { label, index, total } = describePosition(
        String(active.id),
        over ? String(over.id) : null,
      );
      return `"${label}" moved to position ${index} of ${total}.`;
    },
    onDragEnd({ active, over }) {
      const { label, index, total } = describePosition(
        String(active.id),
        over ? String(over.id) : null,
      );
      return `"${label}" dropped at position ${index} of ${total}.`;
    },
    onDragCancel({ active }) {
      const { label, index, total } = describePosition(String(active.id), null);
      return `Reordering cancelled. "${label}" returned to position ${index} of ${total}.`;
    },
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function useSortableItem(id: string) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return {
    setNodeRef,
    style: {
      // Horizontal drift locked — a vertical list never needs it.
      transform: transform
        ? CSS.Translate.toString({ ...transform, x: 0 })
        : undefined,
      transition,
    },
    handleProps: { ...attributes, ...listeners },
    isDragging,
  };
}

// Optimistic drag-drop reorder: sets the new order immediately, persists via
// `reorder`, and rolls back to `items` on error once the transition settles.
// Stamps `order` to match the new index so a live re-sort by that same field
// (DataTable's `reorder.orderKey`) reflects the drop instead of reverting it.
export function useOptimisticReorder<T extends { id: string; order: number }>(
  items: T[],
  reorder: (ids: string[]) => Promise<{ error: string } | void>,
  onSaved?: (next: T[]) => void,
) {
  const [isReordering, startReorder] = useTransition();
  const [optimisticItems, setOptimisticItems] = useOptimistic(
    items,
    (_, next: T[]) => next,
  );

  function handleReorder(ids: string[]) {
    const byId = new Map(optimisticItems.map((item) => [item.id, item]));
    const next = ids
      .map((id, index) => {
        const item = byId.get(id);
        return item ? { ...item, order: index + 1 } : undefined;
      })
      .filter((item): item is T => item !== undefined);

    startReorder(async () => {
      setOptimisticItems(next);
      try {
        const result = await reorder(ids);
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        onSaved?.(next);
        toast.success('Order saved');
      } catch (error) {
        console.error(error);
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return { optimisticItems, isReordering, handleReorder };
}

interface SortableHandleProps {
  label: string;
  handleProps: ReturnType<typeof useSortableItem>['handleProps'];
  disabled?: boolean;
  className?: string;
}

export function SortableHandle({
  label,
  handleProps,
  disabled = false,
  className,
}: SortableHandleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      aria-label={`Reorder ${label}`}
      className={cn(
        'text-muted-foreground size-11 touch-none disabled:cursor-not-allowed md:size-8',
        !disabled && 'cursor-grab active:cursor-grabbing',
        className,
      )}
      {...(disabled ? {} : handleProps)}
    >
      <ACTION_ICONS.drag />
    </Button>
  );
}
