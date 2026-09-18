import type { PositionManager } from '@/lib/types';
import { getUserName } from '@/lib/utils';

interface PositionManagersReadonlyProps {
  managers: PositionManager[];
}

// Archived twin of PositionManagersSection — same rows, no remove button and
// no search box, since membership stays admin-only to change once archived.
export function PositionManagersReadonly({
  managers,
}: PositionManagersReadonlyProps) {
  return (
    <div className="flex flex-col gap-4">
      {managers.length === 0 && (
        <p className="text-muted-foreground text-sm">No managers assigned.</p>
      )}

      {managers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {managers.map((manager) => {
            const managerName = getUserName(manager);
            return (
              <li
                key={manager.id}
                className="flex items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {managerName ?? manager.email}
                  </p>
                  {managerName && (
                    <p className="text-muted-foreground text-xs">
                      {manager.email}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-muted-foreground text-sm">
        Managers can&apos;t be changed while this position is archived.
      </p>
    </div>
  );
}
