'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Loader2, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import {
  addPositionManager,
  removePositionManager,
  searchUsers,
} from '@/prisma/actions/position-actions';

import type { PositionManager, UserSearchResult } from '@/lib/types';
import { isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SEARCH_DEBOUNCE_MS = 300;

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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingEmail, setAddingEmail] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Ref holds the debounce timer so typing does not trigger a search per keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears a stale closure's searchUsers call on unmount; a timer has no non-effect home.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }
    // Show the spinner immediately so the user knows their input was registered.
    setIsSearching(true);
    setSearchError(null);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const users = await searchUsers({ query: value });
          if (isError(users)) {
            setResults([]);
            setSearchError(users.error);
          } else {
            // managers captured by closure is the latest value at search time.
            setResults(
              users.filter(
                (u) => !managers.some((m) => m.email === u.primaryEmail),
              ),
            );
          }
        } catch (error) {
          console.error(error);
          setResults([]);
          setSearchError('Search failed. Please try again.');
        } finally {
          setIsSearching(false);
        }
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleAdd(user: UserSearchResult) {
    setAddingEmail(user.primaryEmail);
    startTransition(async () => {
      try {
        const result = await addPositionManager({
          positionId,
          email: user.primaryEmail,
        });

        if (isError(result)) {
          toast.error(result.error);
        } else {
          setManagers((prev) => [...prev, result]);
          setResults([]);
          setQuery('');
          toast.success('Manager added');
        }
      } catch (error) {
        console.error(error);
        toast.error('Something went wrong. Please try again.');
      } finally {
        setAddingEmail(null);
      }
    });
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

            return (
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
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserMinus className="size-4" />
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="manager-search">Add Manager</Label>
        <div className="relative">
          <Input
            id="manager-search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by name or email"
            autoComplete="off"
            maxLength={200}
          />
          {isSearching && (
            <Loader2 className="text-muted-foreground absolute top-2 right-2.5 size-4 animate-spin" />
          )}
        </div>
        {results.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-md border p-1">
            {results.map((user) => (
              <li key={user.primaryEmail}>
                <button
                  type="button"
                  onClick={() => handleAdd(user)}
                  disabled={addingEmail === user.primaryEmail}
                  className="hover:bg-accent flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div>
                    <span className="font-medium">{user.displayName}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {user.primaryEmail}
                    </span>
                  </div>
                  {addingEmail === user.primaryEmail ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!isSearching && searchError && (
          <p
            role="status"
            aria-live="polite"
            className="text-destructive text-sm"
          >
            {searchError}
          </p>
        )}
        {!isSearching &&
          !searchError &&
          query.trim() &&
          results.length === 0 && (
            <p
              role="status"
              aria-live="polite"
              className="text-muted-foreground text-sm"
            >
              No users found.
            </p>
          )}
      </div>
    </div>
  );
}
