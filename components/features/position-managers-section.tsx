'use client';

import { useState, useTransition } from 'react';

import { toast } from 'sonner';

import {
  addPositionManager,
  removePositionManager,
} from '@/prisma/actions/position-actions';

import { ACTION_ICONS } from '@/lib/icons';
import type { PositionManager, UserSearchResult } from '@/lib/types';
import { getUserName } from '@/lib/utils';

import { ManagerPicker } from '@/components/features/manager-picker';
import { Button } from '@/components/ui/button';

interface PositionManagersSectionProps {
  positionId: string;
  initialManagers: PositionManager[];
  currentUserId: string;
  isAdmin: boolean;
}

export function PositionManagersSection({
  positionId,
  initialManagers,
  currentUserId,
  isAdmin,
}: PositionManagersSectionProps) {
  const [managers, setManagers] = useState<PositionManager[]>(initialManagers);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleAdd(user: UserSearchResult): Promise<boolean> {
    try {
      const result = await addPositionManager({
        positionId,
        email: user.primaryEmail,
      });

      if ('error' in result) {
        toast.error(result.error);
        return false;
      }
      setManagers((prev) => [...prev, result]);
      toast.success('Manager added');
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Something went wrong. Please try again.');
      return false;
    }
  }

  function handleRemove(userId: string) {
    // Unreachable past the disabled button, but keeps both rules in one place.
    if (userId === currentUserId && !isAdmin) return;

    setRemovingId(userId);
    startTransition(async () => {
      try {
        const result = await removePositionManager({ positionId, userId });

        if (result && 'error' in result) {
          toast.error(result.error);
        } else {
          setManagers((prev) => prev.filter((m) => m.id !== userId));
          toast.success('Manager removed');
        }
      } catch (error) {
        console.error(error);
        toast.error('Something went wrong. Please try again.');
      } finally {
        setRemovingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {managers.length === 0 && (
        <p className="text-muted-foreground text-sm">No managers assigned.</p>
      )}

      {managers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {managers.map((manager) => {
            const isSelf = manager.id === currentUserId;
            const blockSelfRemoval = isSelf && !isAdmin;
            const managerName = getUserName(manager);

            return (
              <li
                key={manager.id}
                className="flex items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {managerName ?? manager.email}
                  </p>
                  {managerName && (
                    <p className="text-muted-foreground text-xs">
                      {manager.email}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(manager.id)}
                  disabled={removingId === manager.id || blockSelfRemoval}
                  aria-disabled={blockSelfRemoval}
                  title={
                    blockSelfRemoval
                      ? 'You cannot remove yourself as a manager'
                      : undefined
                  }
                >
                  {removingId === manager.id ? (
                    <ACTION_ICONS.pending className="animate-spin" />
                  ) : (
                    <ACTION_ICONS.removeManager />
                  )}
                  <span className="sr-only">
                    {blockSelfRemoval
                      ? 'Remove manager (you cannot remove yourself)'
                      : 'Remove manager'}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <ManagerPicker
        excludeEmails={managers.map((m) => m.email)}
        onSelect={handleAdd}
        label="Add Manager"
      />
    </div>
  );
}
