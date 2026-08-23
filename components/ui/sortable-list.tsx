'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';

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
import { GripVertical } from 'lucide-react';

import { cn } from '@/lib/utils';

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
    <button
      type="button"
      disabled={disabled}
      aria-label={`Reorder ${label}`}
      className={cn(
        'text-muted-foreground focus-visible:ring-ring/50 flex size-11 shrink-0 touch-none items-center justify-center rounded-md focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:size-8',
        !disabled && 'hover:text-foreground cursor-grab active:cursor-grabbing',
        className,
      )}
      {...(disabled ? {} : handleProps)}
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  );
}
