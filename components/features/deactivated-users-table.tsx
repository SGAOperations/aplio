'use client';

import { useState, useTransition } from 'react';

import { UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';

import { reactivateUser } from '@/prisma/actions/users';

import type { AdminDeactivatedUserListItem } from '@/lib/types';
import {
  type SortableColumn,
  useSortableTable,
} from '@/lib/use-sortable-table';
import { formatDate, formatTableCount } from '@/lib/utils';

import { SortableHeader } from '@/components/features/sortable-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DeactivatedUsersTableProps {
  users: AdminDeactivatedUserListItem[];
}

const COLUMNS: SortableColumn<AdminDeactivatedUserListItem>[] = [
  { key: 'user', accessor: (u) => u.name ?? u.email },
  { key: 'deactivated', accessor: (u) => u.deletedAt },
];

// Snapshot at click time — the dialog keeps naming the right user through
// Radix's exit animation even if a revalidation drops the row mid-flight.
interface ReactivateTarget {
  id: string;
  displayName: string;
}

export function DeactivatedUsersTable({ users }: DeactivatedUsersTableProps) {
  const [query, setQuery] = useState('');
  const [reactivateTarget, setReactivateTarget] =
    useState<ReactivateTarget | null>(null);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [isReactivating, startReactivateTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          (u.name ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
    : users;

  const { sortedRows, sort, toggle, ariaSort } = useSortableTable(
    filtered,
    COLUMNS,
    { defaultSort: { key: 'deactivated', direction: 'desc' } },
  );

  function handleReactivateConfirm() {
    if (!reactivateTarget) return;
    const target = reactivateTarget;
    startReactivateTransition(async () => {
      try {
        const result = await reactivateUser({ userId: target.id });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success('User reactivated.');
        setReactivateDialogOpen(false);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  if (users.length === 0)
    return (
      <EmptyState
        icon={UserRoundCheck}
        title="No deactivated accounts"
        description="Accounts you deactivate from Users appear here."
      />
    );

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deactivated-users-search">Search</Label>
            <Input
              id="deactivated-users-search"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <p
            aria-live="polite"
            className="text-muted-foreground self-end text-sm sm:ml-auto"
          >
            {formatTableCount({
              shown: filtered.length,
              total: users.length,
              noun: 'account',
              isFiltered: !!q,
            })}
          </p>
        </div>

        <Card className="gap-0 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader
                  label="User"
                  active={sort.key === 'user'}
                  direction={sort.direction}
                  ariaSort={ariaSort('user')}
                  onToggle={() => toggle('user')}
                />
                <TableHead>Roles</TableHead>
                <SortableHeader
                  label="Deactivated"
                  active={sort.key === 'deactivated'}
                  direction={sort.direction}
                  ariaSort={ariaSort('deactivated')}
                  onToggle={() => toggle('deactivated')}
                />
                <TableHead>Deactivated by</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-center"
                  >
                    No accounts match your search.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((user) => {
                  const displayName = user.name ?? user.email;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{displayName}</span>
                          {user.name && (
                            <span className="text-muted-foreground text-xs">
                              {user.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.isAdmin ? (
                          <Badge variant="default">Admin</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.deletedAt ? (
                          formatDate(user.deletedAt)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.deletedBy ? (
                          (user.deletedBy.name ?? user.deletedBy.email)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReactivateTarget({ id: user.id, displayName });
                            setReactivateDialogOpen(true);
                          }}
                        >
                          Reactivate
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ConfirmDialog
        open={reactivateDialogOpen}
        onOpenChange={setReactivateDialogOpen}
        title={`Reactivate ${reactivateTarget?.displayName}?`}
        description="They'll be able to sign in again immediately with the same email and role. Their applications and answers are untouched."
        confirmLabel="Reactivate"
        pendingLabel="Reactivating…"
        isPending={isReactivating}
        onConfirm={handleReactivateConfirm}
      />
    </>
  );
}
