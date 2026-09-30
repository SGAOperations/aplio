'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import { useQueryStates } from 'nuqs';
import { toast } from 'sonner';

import { deactivateUser, toggleUserAdmin } from '@/prisma/actions/users';

import { USER_ROLE_FILTER_OPTIONS } from '@/lib/constants';
import {
  DATA_TABLE_CELL_TRUNCATE_CLASS,
  DATA_TABLE_CELL_WRAP_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  filterRows,
} from '@/lib/data-table';
import { ACTION_ICONS, CONCEPT_ICONS } from '@/lib/icons';
import { usersSearchParams, usersUrlKeys } from '@/lib/search-params';
import type { AdminUserListItem } from '@/lib/types';
import {
  cn,
  displayUserName,
  formatTableCount,
  getUserName,
  getUserRoleRank,
  getUserRoleTokens,
} from '@/lib/utils';

import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, DataTableRowActions } from '@/components/ui/data-table';
import {
  DataTableToolbar,
  DataTableToolbarField,
} from '@/components/ui/data-table-toolbar';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LocalTime } from '@/components/ui/local-time';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

// preventDefault stops Radix's composed onClose from reversing our setOpen(true).
function ManagedPositionsOverflow({
  hidden,
}: {
  hidden: AdminUserListItem['managedPositions'];
}) {
  const [open, setOpen] = useState(false);
  const titles = hidden.map((p) => p.title).join(', ');
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        type="button"
        className={cn(badgeVariants({ variant: 'outline' }), 'cursor-pointer')}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        +{hidden.length} more
        <span className="sr-only">: {titles}</span>
      </TooltipTrigger>
      <TooltipContent className="max-h-64 overflow-y-auto">
        <ul>
          {hidden.map((pos) => (
            <li key={pos.id}>{pos.title}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const [query, setQuery] = useState('');
  // shallow: the page filters in memory over the already-fetched user list
  // and must not refetch; replace: toggling a checkbox shouldn't stack history.
  const [params, setParams] = useQueryStates(usersSearchParams, {
    urlKeys: usersUrlKeys,
    history: 'replace',
    shallow: true,
  });
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
      displayName: displayUserName(user),
      email: user.email,
      name: getUserName(user),
      makeAdmin: !user.isAdmin,
    });
    setAdminDialogOpen(true);
  }

  function openDeactivateDialog(user: AdminUserListItem) {
    setDeactivateTarget({ id: user.id, displayName: displayUserName(user) });
    setDeactivateDialogOpen(true);
  }

  const COLUMNS: DataTableColumn<AdminUserListItem>[] = useMemo(
    () => [
      {
        key: 'user',
        header: 'User',
        headClassName: 'w-48',
        sortAccessor: (u) => displayUserName(u),
        searchValue: (u) => [displayUserName(u), u.email],
        cell: (u) => {
          const name = getUserName(u);
          return (
            // Matches the name+email stack so nameless rows keep row height.
            <div className="flex min-h-9 flex-col justify-center">
              <span
                className={cn(DATA_TABLE_CELL_TRUNCATE_CLASS, 'font-medium')}
                title={name ?? u.email}
              >
                {name ?? u.email}
              </span>
              {name && (
                <span
                  className={cn(
                    DATA_TABLE_CELL_TRUNCATE_CLASS,
                    'text-muted-foreground text-xs',
                  )}
                  title={u.email}
                >
                  {u.email}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'roles',
        header: 'Roles',
        headClassName: 'w-28',
        sortAccessor: (u) => [getUserRoleRank(u), displayUserName(u), u.email],
        filterValue: getUserRoleTokens,
        cell: (u) => {
          const isManager = getUserRoleTokens(u).includes('manager');
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
        headClassName: 'w-32',
        sortAccessor: (u) => u.createdAt,
        cell: (u) => <LocalTime date={u.createdAt} precision="date" />,
      },
      {
        key: 'lastSignIn',
        header: 'Last sign-in',
        headClassName: 'w-36',
        sortAccessor: (u) => u.lastLoginAt,
        cell: (u) =>
          u.lastLoginAt ? (
            <LocalTime date={u.lastLoginAt} precision="relative" />
          ) : (
            <span className="text-muted-foreground">
              <span aria-hidden>—</span>
              <span className="sr-only">No sign-in recorded</span>
            </span>
          ),
      },
      {
        key: 'applications',
        header: 'Applications',
        headClassName: 'w-32',
        sortAccessor: (u) => u._count.applications,
        cell: (u) => {
          const appCount = u._count.applications;
          return appCount > 0 ? (
            <Button variant="link" size="sm" asChild className="h-auto p-0">
              <Link href={`/manage/applications?userId=${u.id}`}>
                {appCount}
              </Link>
            </Button>
          ) : (
            <span className="text-muted-foreground">0</span>
          );
        },
      },
      {
        key: 'managedPositions',
        header: 'Managed Positions',
        headClassName: 'w-64',
        filterValue: (u) => u.managedPositions.map((p) => p.id),
        searchValue: (u) => u.managedPositions.map((p) => p.title),
        cell: (u) => {
          const isManager = u.managedPositions.length > 0;
          if (!isManager)
            return <span className="text-muted-foreground">—</span>;
          return (
            <div className={DATA_TABLE_CELL_WRAP_CLASS}>
              {u.managedPositions.slice(0, 2).map((pos) => (
                <Badge
                  key={pos.id}
                  variant="outline"
                  className="max-w-full"
                  title={pos.title}
                >
                  <span className="min-w-0 truncate">{pos.title}</span>
                </Badge>
              ))}
              {u.managedPositions.length > 2 && (
                <ManagedPositionsOverflow
                  hidden={u.managedPositions.slice(2)}
                />
              )}
            </div>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        headClassName: 'w-48',
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
                {u.isAdmin ? <ACTION_ICONS.demote /> : <ACTION_ICONS.promote />}
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
                <ACTION_ICONS.deactivate />
                Deactivate
              </Button>
            </DataTableRowActions>
          );
        },
      },
    ],
    [currentUserId],
  );

  const roleOptions = useMemo(
    () =>
      USER_ROLE_FILTER_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
      })),
    [],
  );

  const positionOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const user of users)
      for (const pos of user.managedPositions) byId.set(pos.id, pos.title);
    return Array.from(byId, ([id, title]) => ({
      value: id,
      label: title,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [users]);

  const filters: DataTableFilter[] = [
    { key: 'roles', values: params.roles },
    { key: 'managedPositions', values: params.positionIds },
  ];
  const filtered = filterRows(users, COLUMNS, { query, filters });
  const isFiltered = !!(
    query.trim() ||
    params.roles.length ||
    params.positionIds.length
  );
  const adminCount = filtered.filter((u) => u.isAdmin).length;
  const managerCount = filtered.filter(
    (u) => u.managedPositions.length > 0,
  ).length;

  function clearFilters() {
    setQuery('');
    void setParams(null);
  }

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
        icon={CONCEPT_ICONS.user}
        title="No users found"
        description="Active users will appear here."
      />
    );

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-col gap-4">
          <DataTableToolbar>
            <DataTableToolbarField label="Role" htmlFor="users-role-filter">
              <MultiSelect
                id="users-role-filter"
                options={roleOptions}
                values={params.roles}
                onValuesChange={(roles) => void setParams({ roles })}
                placeholder="All roles"
                noun="role"
              />
            </DataTableToolbarField>

            {positionOptions.length > 0 && (
              <DataTableToolbarField
                label="Managed position"
                htmlFor="users-position-filter"
              >
                <MultiSelect
                  id="users-position-filter"
                  options={positionOptions}
                  values={params.positionIds}
                  onValuesChange={(positionIds) =>
                    void setParams({ positionIds })
                  }
                  placeholder="All positions"
                  noun="position"
                  searchable
                />
              </DataTableToolbarField>
            )}

            <DataTableToolbarField
              label="Search"
              htmlFor="users-search"
              className="sm:w-64"
            >
              <Input
                id="users-search"
                placeholder="Search by name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </DataTableToolbarField>

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full sm:w-auto"
              >
                <ACTION_ICONS.clearFilters />
                Clear filters
              </Button>
            )}

            <p
              aria-live="polite"
              className="text-muted-foreground w-full text-sm sm:ml-auto sm:w-auto sm:self-end"
            >
              {formatTableCount({
                shown: filtered.length,
                total: users.length,
                noun: 'user',
                isFiltered,
              })}
              {` · ${adminCount} ${adminCount === 1 ? 'admin' : 'admins'} · ${managerCount} ${managerCount === 1 ? 'manager' : 'managers'}`}
            </p>
          </DataTableToolbar>

          <DataTable
            rows={filtered}
            columns={COLUMNS}
            getRowKey={(u) => u.id}
            caption="Users"
            defaultSort={{ key: 'roles', direction: 'asc' }}
            noMatchMessage="No users match your filters."
            tableClassName="table-fixed [&]:w-auto"
            mobileCard={(user) => {
              const isSelf = user.id === currentUserId;
              const isManager = getUserRoleTokens(user).includes('manager');
              const appCount = user._count.applications;
              const name = getUserName(user);
              return (
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{name ?? user.email}</span>
                      {name && (
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
                      Joined{' '}
                      <LocalTime date={user.createdAt} precision="date" />
                    </span>
                    <span className="text-muted-foreground">
                      {user.lastLoginAt ? (
                        <>
                          Last sign-in{' '}
                          <LocalTime
                            date={user.lastLoginAt}
                            precision="relative"
                          />
                        </>
                      ) : (
                        'No sign-in recorded'
                      )}
                    </span>
                    {appCount > 0 ? (
                      <Button
                        variant="link"
                        size="sm"
                        asChild
                        className="h-auto p-0"
                      >
                        <Link href={`/manage/applications?userId=${user.id}`}>
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
                      {user.managedPositions.map((pos) => (
                        <Badge key={pos.id} variant="outline">
                          {pos.title}
                        </Badge>
                      ))}
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
                      {user.isAdmin ? (
                        <ACTION_ICONS.demote />
                      ) : (
                        <ACTION_ICONS.promote />
                      )}
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
                      <ACTION_ICONS.deactivate />
                      Deactivate
                    </Button>
                  </DataTableRowActions>
                </div>
              );
            }}
          />
        </div>
      </TooltipProvider>

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
