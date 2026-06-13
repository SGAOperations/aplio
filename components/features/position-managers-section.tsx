'use client';

import { useState, useTransition } from 'react';

import { Loader2, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import type { User } from '@/prisma/client';
import {
  addPositionManager,
  removePositionManager,
  searchUsers,
} from '@/prisma/services/position-actions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserResult {
  id: string;
  displayName: string;
  primaryEmail: string;
}

interface PositionManagersSectionProps {
  positionId: string;
  initialManagers: User[];
  isAdmin: boolean;
}

export function PositionManagersSection({
  positionId,
  initialManagers,
  isAdmin,
}: PositionManagersSectionProps) {
  const [managers, setManagers] = useState(initialManagers);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    startTransition(async () => {
      const users = await searchUsers(value);
      setResults(users.filter((u) => !managers.some((m) => m.id === u.id)));
      setIsSearching(false);
    });
  }

  function handleAdd(user: UserResult) {
    setAddingId(user.id);
    startTransition(async () => {
      const result = await addPositionManager({
        positionId,
        userId: user.id,
      });

      if (result.ok) {
        setManagers((prev) => [
          ...prev,
          {
            id: user.id,
            name: user.displayName,
            email: user.primaryEmail,
            neonAuthId: '',
            isAdmin: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            createdById: null,
            updatedById: null,
            deletedById: null,
          },
        ]);
        setResults((prev) => prev.filter((u) => u.id !== user.id));
        setQuery('');
        toast.success('Manager added');
      } else {
        toast.error(result.error);
      }
      setAddingId(null);
    });
  }

  function handleRemove(userId: string) {
    setRemovingId(userId);
    startTransition(async () => {
      const result = await removePositionManager({ positionId, userId });

      if (result.ok) {
        setManagers((prev) => prev.filter((m) => m.id !== userId));
        toast.success('Manager removed');
      } else {
        toast.error(result.error);
      }
      setRemovingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {managers.length === 0 && (
        <p className="text-muted-foreground text-sm">No managers assigned.</p>
      )}

      {managers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {managers.map((manager) => (
            <li
              key={manager.id}
              className="flex items-center justify-between gap-2 rounded-md border p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {manager.name ?? manager.email}
                </p>
                {manager.name && (
                  <p className="text-muted-foreground text-xs">
                    {manager.email}
                  </p>
                )}
              </div>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(manager.id)}
                  disabled={removingId === manager.id}
                >
                  {removingId === manager.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserMinus className="size-4" />
                  )}
                  <span className="sr-only">Remove manager</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="manager-search">Add Manager</Label>
          <Input
            id="manager-search"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name or email"
            disabled={isSearching}
          />
          {isSearching && (
            <p className="text-muted-foreground text-sm">Searching...</p>
          )}
          {results.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md border p-1">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleAdd(user)}
                    disabled={addingId === user.id}
                    className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div>
                      <span className="font-medium">{user.displayName}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {user.primaryEmail}
                      </span>
                    </div>
                    {addingId === user.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isSearching && query.trim() && results.length === 0 && (
            <p className="text-muted-foreground text-sm">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
}
