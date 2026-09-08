'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { searchUsers } from '@/prisma/actions/position-actions';

import { ACTION_ICONS } from '@/lib/icons';
import type { UserSearchResult } from '@/lib/types';
import { isError } from '@/lib/utils';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SEARCH_DEBOUNCE_MS = 300;

interface ManagerPickerProps {
  excludeEmails: string[];
  onSelect: (user: UserSearchResult) => Promise<boolean>;
  disabled?: boolean;
  inputId?: string;
  label?: string;
  describedBy?: string;
}

export function ManagerPicker({
  excludeEmails,
  onSelect,
  disabled,
  inputId = 'manager-search',
  label = 'Add manager',
  describedBy,
}: ManagerPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
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
            setResults(
              users.filter((u) => !excludeEmails.includes(u.primaryEmail)),
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

  function handleSelect(user: UserSearchResult) {
    setAddingEmail(user.primaryEmail);
    startTransition(async () => {
      try {
        const success = await onSelect(user);
        if (success) {
          setResults([]);
          setQuery('');
        }
      } finally {
        setAddingEmail(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          placeholder="Search by name or email"
          autoComplete="off"
          maxLength={200}
          disabled={disabled}
          aria-describedby={describedBy}
        />
        {isSearching && (
          <ACTION_ICONS.pending className="text-muted-foreground absolute top-2 right-2.5 size-4 animate-spin" />
        )}
      </div>
      {results.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border p-1">
          {results.map((user) => (
            <li key={user.primaryEmail}>
              <button
                type="button"
                onClick={() => handleSelect(user)}
                disabled={addingEmail === user.primaryEmail}
                className="hover:bg-accent flex min-h-11 w-full items-center justify-between rounded px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
              >
                <div>
                  <span className="font-medium">{user.displayName}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {user.primaryEmail}
                  </span>
                </div>
                {addingEmail === user.primaryEmail ? (
                  <ACTION_ICONS.pending className="size-4 animate-spin" />
                ) : (
                  <ACTION_ICONS.addManager className="size-4" />
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
      {!isSearching && !searchError && query.trim() && results.length === 0 && (
        <p
          role="status"
          aria-live="polite"
          className="text-muted-foreground text-sm"
        >
          No users found.
        </p>
      )}
    </div>
  );
}
