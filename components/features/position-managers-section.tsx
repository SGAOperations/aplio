'use client';

import { useRef, useState, useTransition } from 'react';

import { Loader2, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import {
  addPositionManager,
  removePositionManager,
  searchUsers,
} from '@/prisma/services/position-actions';
import type { PositionManager } from '@/prisma/services/positions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SEARCH_DEBOUNCE_MS = 300;

interface UserResult {
  id: string;
  displayName: string;
  primaryEmail: string;
}

interface PositionManagersSectionProps {
  positionId: string;
  initialManagers: PositionManager[];
  isAdmin: boolean;
}

export function PositionManagersSection({
  positionId,
  initialManagers,
  isAdmin,
}: PositionManagersSectionProps) {
  const [managers, setManagers] = useState<PositionManager[]>(initialManagers);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Ref holds the debounce timer so typing does not trigger a search per keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    // Show the spinner immediately so the user knows their input was registered.
    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const users = await searchUsers({ query: value });
        // managers captured by closure is the latest value at search time.
        setResults(users.filter((u) => !managers.some((m) => m.id === u.id)));
        setIsSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleAdd(user: UserResult) {
    setAddingId(user.id);
    startTransition(async () => {
      const result = await addPositionManager({ positionId, userId: user.id });

      if (result.ok) {
        setManagers((prev) => [
          ...prev,
          { id: user.id, name: user.displayName, email: user.primaryEmail },
        ]);
        setResults([]);
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
          <div className="relative">
            <Input
              id="manager-search"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by name or email"
              autoComplete="off"
            />
            {isSearching && (
              <Loader2 className="text-muted-foreground absolute top-2 right-2.5 size-4 animate-spin" />
            )}
          </div>
          {results.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md border p-1">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleAdd(user)}
                    disabled={addingId === user.id}
                    className="hover:bg-accent flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
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
