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
      <TabsList className="w-full">
        <TabsTrigger value="details" className="flex-1">
          Details
        </TabsTrigger>
        <TabsTrigger value="questions" className="flex-1">
          Questions
        </TabsTrigger>
        {managersContent && (
          <TabsTrigger value="managers" className="flex-1">
            Managers
          </TabsTrigger>
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
