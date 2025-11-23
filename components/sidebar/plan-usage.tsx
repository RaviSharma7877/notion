'use client';
import { MAX_FOLDERS_FREE_PLAN } from '@/lib/constants';
import { useAppState } from '@/lib/providers/state-provider';
import type { SubscriptionDto } from '@/lib/queries';
import React, { useMemo } from 'react';
import { Progress } from '../ui/progress';
import CypressDiamondIcon from '../icons/cypressDiamongIcon';
import TooltipComponent from '../global/tooltip-component';
import { twMerge } from 'tailwind-merge';

interface PlanUsageProps {
  foldersLength: number;
  subscription: SubscriptionDto | null;
  collapsed?: boolean;
}

const PlanUsage: React.FC<PlanUsageProps> = ({
  foldersLength,
  subscription,
  collapsed = false,
}) => {
  const { workspaceId, state } = useAppState();

  const isProPlan = useMemo(
    () => (subscription?.status ?? '').toUpperCase() === 'ACTIVE',
    [subscription?.status]
  );

  const usagePercentage = useMemo(() => {
    const stateFoldersLength = state.workspaces.find(
      (workspace) => workspace.id === workspaceId
    )?.folders.length;
    const totalFolders = stateFoldersLength ?? foldersLength;
    return (totalFolders / MAX_FOLDERS_FREE_PLAN) * 100;
  }, [state, workspaceId, foldersLength]);

  if (collapsed) {
    const message = isProPlan
      ? 'Pro plan'
      : `Free plan · ${Math.min(100, Math.round(usagePercentage))}% of folder quota used`;
    return (
      <TooltipComponent message={message}>
        <div
          className={twMerge(
            'flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground transition hover:text-foreground'
          )}
        >
          <CypressDiamondIcon />
        </div>
      </TooltipComponent>
    );
  }

  return (
    <article className="mb-4">
      {!isProPlan && (
        <div
          className="flex 
          gap-2
          text-muted-foreground
          mb-2
          items-center
        "
        >
          <div className="h-4 w-4">
            <CypressDiamondIcon />
          </div>
          <div
            className="flex 
        justify-between 
        w-full 
        items-center
        "
          >
            <div>Free Plan</div>
            <small>{usagePercentage.toFixed(0)}% / 100%</small>
          </div>
        </div>
      )}
      {!isProPlan && (
        <Progress
          value={usagePercentage}
          className="h-1"
        />
      )}
    </article>
  );
};

export default PlanUsage;
