'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ChevronDown, ChevronUp } from 'lucide-react';

import type { PositionWithQuestions } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PositionCardProps {
  position: PositionWithQuestions;
}

export function PositionCard({ position }: PositionCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="gap-0 p-0">
      <CardHeader className="p-0">
        <button
          type="button"
          className="flex w-full items-center justify-between p-6 text-left"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <CardTitle className="text-lg">{position.title}</CardTitle>
          {open ? (
            <ChevronUp className="text-muted-foreground size-5 shrink-0" />
          ) : (
            <ChevronDown className="text-muted-foreground size-5 shrink-0" />
          )}
        </button>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-4 px-6 pb-6">
          <p className="text-muted-foreground text-sm">
            {position.description}
          </p>

          {position.questions.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Application questions</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                {position.questions.map(
                  (question: PositionWithQuestions['questions'][number]) => (
                    <li key={question.id}>{question.label}</li>
                  ),
                )}
              </ul>
            </div>
          )}

          <div className="pt-2">
            <Button asChild>
              <Link href={`/positions/${position.id}/apply`}>Apply</Link>
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
