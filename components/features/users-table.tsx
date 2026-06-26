'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { Users } from 'lucide-react';
import { toast } from 'sonner';

import { deactivateUser, toggleUserAdmin } from '@/prisma/actions/users';

import type { AdminUserListItem } from '@/lib/types';
import { formatDate } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface UsersTableProps {
  users: AdminUserListItem[];
  currentUserId: string;
}

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const [query, setQuery] = useState('');
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(
    null,
  );
  const [togglingAdminId, setTogglingAdminId] = useState<string | null>(null);
  const [, startToggleTransition] = useTransition();
  const [isPendingDeactivate, startDeactivateTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          (u.name ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
    : users;

  function handleToggleAdmin(userId: string, makeAdmin: boolean) {
    setTogglingAdminId(userId);
    startToggleTransition(async () => {
      try {
        const result = await toggleUserAdmin({ userId, makeAdmin });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success(makeAdmin ? 'User promoted to admin.' : 'Admin removed.');
      } catch {
        toast.error('Something went wrong. Please try again.');
      } finally {
        setTogglingAdminId(null);
      }
    });
  }

  function handleDeactivateConfirm() {
    if (!confirmDeactivateId) return;
    const targetId = confirmDeactivateId;
    startDeactivateTransition(async () => {
      try {
        const result = await deactivateUser({ userId: targetId });
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        toast.success('User deactivated.');
        setConfirmDeactivateId(null);
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

        <Card className="gap-0 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Applications</TableHead>
                <TableHead>Managed Positions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-center"
                  >
                    No users match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isManager = user.managedPositions.length > 0;
                  const appCount = user._count.applications;
                  const isTogglingAdmin = togglingAdminId === user.id;

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
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
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
                            disabled={isSelf || isTogglingAdmin}
                            title={
                              isSelf
                                ? 'You cannot change your own admin role'
                                : undefined
                            }
                            aria-disabled={isSelf}
                            onClick={() =>
                              handleToggleAdmin(user.id, !user.isAdmin)
                            }
                          >
                            {isTogglingAdmin
                              ? 'Saving…'
                              : user.isAdmin
                                ? 'Remove admin'
                                : 'Make admin'}
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
                            onClick={() => setConfirmDeactivateId(user.id)}
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

      <Dialog
        open={!!confirmDeactivateId}
        onOpenChange={(open) => !open && setConfirmDeactivateId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate user?</DialogTitle>
            <DialogDescription>
              This will block the user from accessing the app on their next
              request. This action cannot be undone from this page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeactivateId(null)}
              disabled={isPendingDeactivate}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateConfirm}
              disabled={isPendingDeactivate}
            >
              {isPendingDeactivate ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
