'use client';

import type { ReactNode } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PositionEditTabsProps {
  detailsContent: ReactNode;
  questionsContent: ReactNode;
  managersContent: ReactNode | null;
}

export function PositionEditTabs({
  detailsContent,
  questionsContent,
  managersContent,
}: PositionEditTabsProps) {
  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="questions">Questions</TabsTrigger>
        {managersContent && (
          <TabsTrigger value="managers">Managers</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="details" className="mt-6">
        {detailsContent}
      </TabsContent>

      <TabsContent value="questions" className="mt-6">
        {questionsContent}
      </TabsContent>

      {managersContent && (
        <TabsContent value="managers" className="mt-6">
          {managersContent}
        </TabsContent>
      )}
    </Tabs>
  );
}
