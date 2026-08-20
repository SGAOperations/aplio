'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import { Users } from 'lucide-react';
import { toast } from 'sonner';

import { deactivateUser, toggleUserAdmin } from '@/prisma/actions/users';

import { type DataTableColumn, filterRows } from '@/lib/data-table';
import type { AdminUserListItem } from '@/lib/types';
import { formatTableCount } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, DataTableRowActions } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocalTime } from '@/components/ui/local-time';

interface UsersTableProps {
  users: AdminUserListItem[];
  currentUserId: string;
}

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

  function openAdminDialog(user: AdminUserListItem) {
    setAdminTarget({
      id: user.id,
      displayName: user.name ?? user.email,
      email: user.email,
      name: user.name,
      makeAdmin: !user.isAdmin,
    });
    setAdminDialogOpen(true);
  }

  function openDeactivateDialog(user: AdminUserListItem) {
    setDeactivateTarget({ id: user.id, displayName: user.name ?? user.email });
    setDeactivateDialogOpen(true);
  }

  const COLUMNS: DataTableColumn<AdminUserListItem>[] = useMemo(
    () => [
      {
        key: 'user',
        header: 'User',
        sortAccessor: (u) => u.name ?? u.email,
        filterValue: (u) => [u.name ?? '', u.email],
        cell: (u) => (
          <div className="flex flex-col">
            <span className="font-medium">{u.name ?? u.email}</span>
            {u.name && (
              <span className="text-muted-foreground text-xs">{u.email}</span>
            )}
          </div>
        ),
      },
      {
        key: 'roles',
        header: 'Roles',
        cell: (u) => {
          const isManager = u.managedPositions.length > 0;
          return (
            <div className="flex flex-wrap gap-1">
              {u.isAdmin && <Badge variant="default">Admin</Badge>}
              {isManager && <Badge variant="secondary">Manager</Badge>}
              {!u.isAdmin && !isManager && (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          );
        },
      },
      {
        key: 'joined',
        header: 'Joined',
        sortAccessor: (u) => u.createdAt,
        cell: (u) => <LocalTime date={u.createdAt} precision="date" />,
      },
      {
        key: 'applications',
        header: 'Applications',
        sortAccessor: (u) => u._count.applications,
        cell: (u) => {
          const appCount = u._count.applications;
          return appCount > 0 ? (
            <Button variant="link" size="sm" asChild className="h-auto p-0">
              <Link href={`/applications?userId=${u.id}`}>{appCount}</Link>
            </Button>
          ) : (
            <span className="text-muted-foreground">0</span>
          );
        },
      },
      {
        key: 'managedPositions',
        header: 'Managed Positions',
        cell: (u) => {
          const isManager = u.managedPositions.length > 0;
          if (!isManager)
            return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {u.managedPositions.slice(0, 2).map((pos) => (
                <Badge key={pos.id} variant="outline">
                  {pos.title}
                </Badge>
              ))}
              {u.managedPositions.length > 2 && (
                <Badge variant="outline">
                  +{u.managedPositions.length - 2} more
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        cellClassName: 'text-right',
        cell: (u) => {
          const isSelf = u.id === currentUserId;
          return (
            <DataTableRowActions className="justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={isSelf}
                title={
                  isSelf ? 'You cannot change your own admin role' : undefined
                }
                aria-disabled={isSelf}
                onClick={() => openAdminDialog(u)}
              >
                {u.isAdmin ? 'Remove admin' : 'Make admin'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isSelf}
                title={
                  isSelf ? 'You cannot deactivate your own account' : undefined
                }
                aria-disabled={isSelf}
                onClick={() => openDeactivateDialog(u)}
              >
                Deactivate
              </Button>
            </DataTableRowActions>
          );
        },
      },
    ],
    [currentUserId],
  );

  const filtered = filterRows(users, COLUMNS, { query });

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
              isFiltered: !!query.trim(),
            })}
          </p>
        </div>

        <DataTable
          rows={filtered}
          columns={COLUMNS}
          getRowKey={(u) => u.id}
          caption="Users"
          defaultSort={{ key: 'joined', direction: 'desc' }}
          noMatchMessage="No users match your search."
          mobileCard={(user) => {
            const isSelf = user.id === currentUserId;
            const isManager = user.managedPositions.length > 0;
            const appCount = user._count.applications;
            return (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
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
                  <div className="flex flex-wrap justify-end gap-1">
                    {user.isAdmin && <Badge variant="default">Admin</Badge>}
                    {isManager && <Badge variant="secondary">Manager</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    Joined <LocalTime date={user.createdAt} precision="date" />
                  </span>
                  {appCount > 0 ? (
                    <Button
                      variant="link"
                      size="sm"
                      asChild
                      className="h-auto p-0"
                    >
                      <Link href={`/applications?userId=${user.id}`}>
                        {appCount}{' '}
                        {appCount === 1 ? 'application' : 'applications'}
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">
                      0 applications
                    </span>
                  )}
                </div>
                {isManager && (
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
                )}
                <DataTableRowActions>
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
                    onClick={() => openAdminDialog(user)}
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
                    onClick={() => openDeactivateDialog(user)}
                  >
                    Deactivate
                  </Button>
                </DataTableRowActions>
              </div>
            );
          }}
        />
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
            blocked from signing back in. Reactivating requires a direct
            database change — contact engineering.
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
