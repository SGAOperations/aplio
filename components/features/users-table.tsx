'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { Users } from 'lucide-react';
import { toast } from 'sonner';

import { deactivateUser, toggleUserAdmin } from '@/prisma/actions/users';

import type { AdminUserListItem } from '@/lib/types';
import {
  type SortableColumn,
  useSortableTable,
} from '@/lib/use-sortable-table';
import { formatTableCount } from '@/lib/utils';

import { SortableHeader } from '@/components/features/sortable-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocalTime } from '@/components/ui/local-time';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UsersTableProps {
  users: AdminUserListItem[];
  currentUserId: string;
}

const COLUMNS: SortableColumn<AdminUserListItem>[] = [
  { key: 'user', accessor: (u) => u.name ?? u.email },
  { key: 'joined', accessor: (u) => u.createdAt },
  { key: 'applications', accessor: (u) => u._count.applications },
];

// Row snapshot for a pending confirmation — captured at click time rather
// than looked up by id later, so the dialog stays readable naming the right
// user even if a revalidation drops the row mid-flight.
interface AdminTarget {
  id: string;
  displayName: string;
  email: string;
  name: string | null;
  makeAdmin: boolean;
}

interface DeactivateTarget {
  id: string;
  displayName: string;
}

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const [query, setQuery] = useState('');
  // `*Target` is never nulled on close — only replaced on the next open —
  // so the dialog's title/description keep the last valid value through
  // Radix's exit animation instead of re-rendering "undefined" mid-fade.
  // `*DialogOpen` alone drives visibility.
  const [adminTarget, setAdminTarget] = useState<AdminTarget | null>(null);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] =
    useState<DeactivateTarget | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [isTogglingAdmin, startToggleTransition] = useTransition();
  const [isDeactivating, startDeactivateTransition] = useTransition();

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
    { defaultSort: { key: 'joined', direction: 'desc' } },
  );

  function handleToggleAdminConfirm() {
    if (!adminTarget) return;
    const target = adminTarget;
    startToggleTransition(async () => {
      try {
        const result = await toggleUserAdmin({
          userId: target.id,
          makeAdmin: target.makeAdmin,
        });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success(
          target.makeAdmin ? 'User promoted to admin.' : 'Admin removed.',
        );
        setAdminDialogOpen(false);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  function handleDeactivateConfirm() {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    startDeactivateTransition(async () => {
      try {
        const result = await deactivateUser({ userId: target.id });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success('User deactivated.');
        setDeactivateDialogOpen(false);
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  if (users.length === 0)
    return (
      <EmptyState
        icon={Users}
        title="No users found"
        description="Active users will appear here."
      />
    );

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="users-search">Search</Label>
            <Input
              id="users-search"
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
              noun: 'user',
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
                  label="Joined"
                  active={sort.key === 'joined'}
                  direction={sort.direction}
                  ariaSort={ariaSort('joined')}
                  onToggle={() => toggle('joined')}
                />
                <SortableHeader
                  label="Applications"
                  active={sort.key === 'applications'}
                  direction={sort.direction}
                  ariaSort={ariaSort('applications')}
                  onToggle={() => toggle('applications')}
                />
                <TableHead>Managed Positions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-center"
                  >
                    No users match your search.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isManager = user.managedPositions.length > 0;
                  const appCount = user._count.applications;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.name ?? user.email}
                          </span>
                          {user.name && (
                            <span className="text-muted-foreground text-xs">
                              {user.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.isAdmin && (
                            <Badge variant="default">Admin</Badge>
                          )}
                          {isManager && (
                            <Badge variant="secondary">Manager</Badge>
                          )}
                          {!user.isAdmin && !isManager && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <LocalTime date={user.createdAt} precision="date" />
                      </TableCell>
                      <TableCell>
                        {appCount > 0 ? (
                          <Button
                            variant="link"
                            size="sm"
                            asChild
                            className="h-auto p-0"
                          >
                            <Link href={`/applications?userId=${user.id}`}>
                              {appCount}
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isManager ? (
                          <div className="flex flex-wrap gap-1">
                            {user.managedPositions.slice(0, 2).map((pos) => (
                              <Badge key={pos.id} variant="outline">
                                {pos.title}
                              </Badge>
                            ))}
                            {user.managedPositions.length > 2 && (
                              <Badge variant="outline">
                                +{user.managedPositions.length - 2} more
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSelf}
                            title={
                              isSelf
                                ? 'You cannot change your own admin role'
                                : undefined
                            }
                            aria-disabled={isSelf}
                            onClick={() => {
                              setAdminTarget({
                                id: user.id,
                                displayName: user.name ?? user.email,
                                email: user.email,
                                name: user.name,
                                makeAdmin: !user.isAdmin,
                              });
                              setAdminDialogOpen(true);
                            }}
                          >
                            {user.isAdmin ? 'Remove admin' : 'Make admin'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isSelf}
                            title={
                              isSelf
                                ? 'You cannot deactivate your own account'
                                : undefined
                            }
                            aria-disabled={isSelf}
                            onClick={() => {
                              setDeactivateTarget({
                                id: user.id,
                                displayName: user.name ?? user.email,
                              });
                              setDeactivateDialogOpen(true);
                            }}
                          >
                            Deactivate
                          </Button>
                        </div>
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
        open={adminDialogOpen}
        onOpenChange={setAdminDialogOpen}
        title={
          adminTarget?.makeAdmin
            ? `Make ${adminTarget.displayName} an admin?`
            : `Remove admin from ${adminTarget?.displayName}?`
        }
        description={
          adminTarget?.makeAdmin ? (
            <>
              Admins can manage every position, view every application, and
              promote or deactivate other users.{' '}
              {adminTarget.name
                ? `${adminTarget.displayName} (${adminTarget.email})`
                : adminTarget.displayName}{' '}
              gets full access immediately.
            </>
          ) : (
            adminTarget && (
              <>
                {adminTarget.name
                  ? `${adminTarget.displayName} (${adminTarget.email})`
                  : adminTarget.displayName}{' '}
                will lose access to admin-only pages and keep only the positions
                they manage.
              </>
            )
          )
        }
        confirmLabel={adminTarget?.makeAdmin ? 'Make admin' : 'Remove admin'}
        pendingLabel={adminTarget?.makeAdmin ? 'Making admin…' : 'Removing…'}
        destructive={!adminTarget?.makeAdmin}
        isPending={isTogglingAdmin}
        onConfirm={handleToggleAdminConfirm}
      />

      <ConfirmDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        title={`Deactivate ${deactivateTarget?.displayName}?`}
        description={
          <>
            {deactivateTarget?.displayName} will be signed out immediately and
            blocked from signing back in. This can&apos;t be undone from this
            page.
          </>
        }
        confirmLabel="Deactivate"
        pendingLabel="Deactivating…"
        destructive
        isPending={isDeactivating}
        onConfirm={handleDeactivateConfirm}
      />
    </>
  );
}
