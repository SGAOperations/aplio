'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { toast } from 'sonner';

import { createPosition } from '@/prisma/actions/position-actions';

import {
  type CreatePositionFormValues,
  createPositionFormSchema,
} from '@/lib/constants';
import { ACTION_ICONS } from '@/lib/icons';
import type { UserSearchResult } from '@/lib/types';

import { ManagerPicker } from '@/components/features/manager-picker';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';

const defaultValues: CreatePositionFormValues = {
  title: '',
  managerEmails: [],
};

const MANAGERS_INPUT_ID = 'create-position-managers';
const MANAGERS_ERROR_ID = 'create-position-managers-error';

interface PositionFormFieldsProps {
  isAdmin: boolean;
  currentUser: UserSearchResult;
}

// FormDialog wraps children in FormProvider, so isSubmitting comes from
// context; isAdmin/currentUser come from the parent, which doesn't sit in it.
function PositionFormFields({ isAdmin, currentUser }: PositionFormFieldsProps) {
  const { formState, setValue } = useFormContext<CreatePositionFormValues>();
  const isSubmitting = formState.isSubmitting;
  const [selected, setSelected] = useState<UserSearchResult[]>([]);

  function applySelection(next: UserSearchResult[]) {
    setSelected(next);
    setValue(
      'managerEmails',
      next.map((u) => u.primaryEmail),
      { shouldValidate: formState.isSubmitted },
    );
  }

  async function handleAdd(user: UserSearchResult): Promise<boolean> {
    if (selected.some((u) => u.primaryEmail === user.primaryEmail)) return true;
    applySelection([...selected, user]);
    return true;
  }

  function handleRemove(email: string) {
    applySelection(selected.filter((u) => u.primaryEmail !== email));
  }

  const isSelf = selected.some(
    (u) => u.primaryEmail === currentUser.primaryEmail,
  );
  const managersError = formState.errors.managerEmails?.message;

  return (
    <>
      <FormField
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input
                placeholder="Position title"
                disabled={isSubmitting}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Managers</p>
        <p className="text-muted-foreground text-sm">
          Managers can edit this position and review its applications.
        </p>

        {selected.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No managers selected yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selected.map((user) => (
              <li
                key={user.primaryEmail}
                className="flex items-center justify-between gap-2 rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-muted-foreground text-xs">
                    {user.primaryEmail}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isSubmitting}
                  onClick={() => handleRemove(user.primaryEmail)}
                >
                  <ACTION_ICONS.removeManager />
                  <span className="sr-only">Remove {user.displayName}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!isSelf && (
          <div className="flex flex-col gap-1">
            {!isAdmin && (
              <p className="text-muted-foreground text-sm">
                You&apos;re not on this list, so you won&apos;t be able to open
                or edit this position after you create it.
              </p>
            )}
            <Button
              type="button"
              variant="link"
              className="h-auto w-fit p-0"
              disabled={isSubmitting}
              onClick={() => void handleAdd(currentUser)}
            >
              Add yourself
            </Button>
          </div>
        )}

        <ManagerPicker
          excludeEmails={selected.map((u) => u.primaryEmail)}
          onSelect={handleAdd}
          disabled={isSubmitting}
          inputId={MANAGERS_INPUT_ID}
          label="Add manager"
          describedBy={managersError ? MANAGERS_ERROR_ID : undefined}
        />

        {managersError && (
          <p
            id={MANAGERS_ERROR_ID}
            role="alert"
            className="text-destructive text-sm"
          >
            {managersError}
          </p>
        )}
      </div>
    </>
  );
}

interface PositionCreateDialogProps {
  isAdmin: boolean;
  currentUser: UserSearchResult;
}

// Dialog-triggered, so it uses FormDialog directly, as GlobalQuestionDialog does.
export function PositionCreateDialog({
  isAdmin,
  currentUser,
}: PositionCreateDialogProps) {
  const router = useRouter();

  async function onSubmit(data: CreatePositionFormValues): Promise<boolean> {
    const result = await createPosition(data);
    if ('error' in result) {
      toast.error(result.error);
      return false;
    }

    if (isAdmin || data.managerEmails.includes(currentUser.primaryEmail)) {
      toast.success('Position created');
      router.push(`/manage/positions/${result.id}/edit`);
    } else {
      toast.success('Position created. Only its managers can see it now.');
    }
    return true;
  }

  return (
    <FormDialog
      trigger={
        <Button>
          <ACTION_ICONS.create />
          New Position
        </Button>
      }
      title="Create Position"
      schema={createPositionFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitLabel="Create Position"
    >
      <PositionFormFields isAdmin={isAdmin} currentUser={currentUser} />
    </FormDialog>
  );
}
