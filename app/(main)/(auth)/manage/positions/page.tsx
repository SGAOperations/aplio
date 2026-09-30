import type { Metadata } from 'next';

import { getPositionApplicationStats } from '@/prisma/data/applications';
import {
  getAdminPositions,
  getManagedPositions,
} from '@/prisma/data/positions';

import { requireManagerOrAdminOr404 } from '@/lib/auth/guards';
import type { PositionApplicationStats } from '@/lib/types';
import { displayUserName, markdownToPlainText } from '@/lib/utils';

import { ManagedPositionsSection } from '@/components/features/managed-positions-section';
import { PositionCreateDialog } from '@/components/features/position-create-dialog';
import {
  PositionSearchEmpty,
  PositionSearchProvider,
} from '@/components/features/position-search';
import { PositionSearchToolbar } from '@/components/features/position-search-toolbar';
import { PageHeader } from '@/components/layouts/page-header';

import { PositionsScopeSection } from './positions-scope-section';

export const metadata: Metadata = { title: 'Manage Positions' };

export default async function ManagePositionsPage() {
  // The (auth) layout only gates profile completeness, so this gates the role.
  const user = await requireManagerOrAdminOr404();
  const currentUser = {
    displayName: displayUserName(user),
    primaryEmail: user.email,
  };

  if (user.isAdmin) {
    const [allPositions, managedPositions] = await Promise.all([
      getAdminPositions(),
      getManagedPositions(user.id),
    ]);

    if (managedPositions.length === 0) {
      const statsByPosition =
        allPositions.length > 0
          ? await getPositionApplicationStats(allPositions.map((p) => p.id))
          : new Map<string, PositionApplicationStats>();

      const searchItems = allPositions.map((p) => ({
        id: p.id,
        title: p.title,
        description: markdownToPlainText(p.description),
      }));

      return (
        <PositionSearchProvider items={searchItems}>
          <div className="flex flex-col gap-6">
            <PageHeader
              title="All Positions"
              description="Every position, with its application stats."
              actions={
                <div className="flex items-center gap-6">
                  <PositionCreateDialog
                    isAdmin={user.isAdmin}
                    currentUser={currentUser}
                  />
                  <PositionSearchToolbar id="all-positions-search" />
                </div>
              }
            />
            <ManagedPositionsSection
              positions={allPositions}
              statsByPosition={statsByPosition}
              emptyDescription="Create your first position to start accepting applications."
              emptyAction={
                <PositionCreateDialog
                  isAdmin={user.isAdmin}
                  currentUser={currentUser}
                />
              }
              noProvider
            />
            <PositionSearchEmpty />
          </div>
        </PositionSearchProvider>
      );
    }

    const managedIds = new Set(managedPositions.map((p) => p.id));
    const otherPositions = allPositions.filter((p) => !managedIds.has(p.id));
    const allIds = [
      ...new Set([...managedPositions, ...allPositions].map((p) => p.id)),
    ];
    const statsByPosition =
      allIds.length > 0
        ? await getPositionApplicationStats(allIds)
        : new Map<string, PositionApplicationStats>();

    const searchItems = [...managedPositions, ...otherPositions].map((p) => ({
      id: p.id,
      title: p.title,
      description: markdownToPlainText(p.description),
    }));

    return (
      <PositionSearchProvider items={searchItems}>
        <div className="flex flex-col gap-10">
          <PageHeader
            title="Manage Positions"
            actions={
              <div className="flex items-center gap-6">
                <PositionCreateDialog
                  isAdmin={user.isAdmin}
                  currentUser={currentUser}
                />
                <PositionSearchToolbar id="manage-positions-search" />
              </div>
            }
          />
          <div className="flex flex-col gap-10">
            <PositionsScopeSection
              id="managed-positions"
              title="Positions You Manage"
              count={managedPositions.length}
            >
              <ManagedPositionsSection
                positions={managedPositions}
                statsByPosition={statsByPosition}
                nestedUnder="managed"
                noProvider
              />
            </PositionsScopeSection>
            <PositionsScopeSection
              id="other-positions"
              title="All Other Positions"
              count={otherPositions.length}
            >
              {otherPositions.length > 0 ? (
                <ManagedPositionsSection
                  positions={otherPositions}
                  statsByPosition={statsByPosition}
                  nestedUnder="other"
                  noProvider
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Every position is one you manage.
                </p>
              )}
            </PositionsScopeSection>
          </div>
          <PositionSearchEmpty />
        </div>
      </PositionSearchProvider>
    );
  }

  const managedPositions = await getManagedPositions(user.id);
  const statsByPosition =
    managedPositions.length > 0
      ? await getPositionApplicationStats(managedPositions.map((p) => p.id))
      : new Map<string, PositionApplicationStats>();

  const searchItems = managedPositions.map((p) => ({
    id: p.id,
    title: p.title,
    description: markdownToPlainText(p.description),
  }));

  return (
    <PositionSearchProvider items={searchItems}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Manage Positions"
          description="Track applications and edit the positions you manage."
          actions={
            <div className="flex items-center gap-6">
              <PositionCreateDialog
                isAdmin={user.isAdmin}
                currentUser={currentUser}
              />
              <PositionSearchToolbar id="manage-positions-search" />
            </div>
          }
        />
        <ManagedPositionsSection
          positions={managedPositions}
          statsByPosition={statsByPosition}
          emptyDescription="Positions you manage appear here. Create one to start accepting applications."
          emptyAction={
            <PositionCreateDialog
              isAdmin={user.isAdmin}
              currentUser={currentUser}
            />
          }
          noProvider
        />
        <PositionSearchEmpty />
      </div>
    </PositionSearchProvider>
  );
}
