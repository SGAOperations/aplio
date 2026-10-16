'use client';

import { useState, useTransition } from 'react';

import { toast } from 'sonner';

import { connectSlack, disconnectSlack } from '@/prisma/actions/slack';

import { ACTION_ICONS } from '@/lib/icons';
import { isError } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export function SlackConnectButton() {
  const [isPending, startTransition] = useTransition();
  const [isRedirecting, setIsRedirecting] = useState(false);

  function handleConnect() {
    startTransition(async () => {
      try {
        const result = await connectSlack();
        if (isError(result)) {
          toast.error(result.error);
          return;
        }
        if (result.status === 'connected') {
          toast.success('Slack is already connected.');
          return;
        }
        setIsRedirecting(true);
        window.location.assign(result.url);
      } catch (err) {
        console.error('connectSlack failed', err);
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  const pending = isPending || isRedirecting;

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={handleConnect}
      className="w-full sm:w-auto"
    >
      {pending ? (
        <ACTION_ICONS.pending className="animate-spin" />
      ) : (
        <ACTION_ICONS.connect />
      )}
      {isRedirecting ? 'Redirecting to Slack…' : 'Connect Slack'}
    </Button>
  );
}

interface SlackDisconnectButtonProps {
  handleLabel: string | null;
}

export function SlackDisconnectButton({
  handleLabel,
}: SlackDisconnectButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDisconnect() {
    startTransition(async () => {
      try {
        await disconnectSlack();
        toast.success('Slack disconnected.');
        setConfirmOpen(false);
      } catch (err) {
        console.error('disconnectSlack failed', err);
        toast.error('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setConfirmOpen(true)}
        className="w-full sm:w-auto"
      >
        <ACTION_ICONS.disconnect />
        Disconnect
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect Slack?"
        description={
          handleLabel
            ? `Aplio will stop using ${handleLabel}. You can connect again at any time.`
            : 'Aplio will stop using your Slack account. You can connect again at any time.'
        }
        confirmLabel="Disconnect"
        pendingLabel="Disconnecting…"
        destructive
        isPending={isPending}
        onConfirm={handleDisconnect}
      />
    </>
  );
}
