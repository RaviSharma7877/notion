'use client';

import React, { useMemo } from 'react';

import { useAuth } from '@/lib/providers/auth-provider';
import type { SubscriptionDto } from '@/lib/queries';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import CypressProfileIcon from '../icons/cypressProfileIcon';
import ModeToggle from '../global/mode-toggle';
import { LogOut } from 'lucide-react';
import LogoutButton from '../global/logout-button';
import { NotificationBell } from '../notifications';
import TooltipComponent from '../global/tooltip-component';
import { twMerge } from 'tailwind-merge';

interface UserCardProps {
  subscription: SubscriptionDto | null;
  collapsed?: boolean;
  onExpandRequest?: () => void;
}

const UserCard: React.FC<UserCardProps> = ({ subscription, collapsed = false, onExpandRequest }) => {
  const { user, subscription: contextSubscription } = useAuth();

  const activeSubscription = useMemo<SubscriptionDto | null>(() => {
    return subscription ?? contextSubscription ?? null;
  }, [subscription, contextSubscription]);

  if (!user) {
    return null;
  }

  const avatarUrl = user.avatarUrl ?? '';
  const isPro = (activeSubscription?.status ?? '').toUpperCase() === 'ACTIVE';

  if (collapsed) {
    return (
      <article className="flex flex-col items-center gap-3 rounded-3xl border border-border/50 bg-background/85 px-3 py-3">
        <TooltipComponent message={user.email ?? ''}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback>
              <CypressProfileIcon />
            </AvatarFallback>
          </Avatar>
        </TooltipComponent>
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{isPro ? 'Pro' : 'Free'} plan</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <TooltipComponent message="Notifications">
            <NotificationBell />
          </TooltipComponent>
          <TooltipComponent message="Toggle theme">
            <ModeToggle />
          </TooltipComponent>
          <TooltipComponent message="Logout">
            <LogoutButton>
              <LogOut />
            </LogoutButton>
          </TooltipComponent>
        </div>
        <button
          type="button"
          onClick={() => onExpandRequest?.()}
          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Expand details
        </button>
      </article>
    );
  }

  return (
    <article
      className={twMerge(
        'hidden sm:flex items-center justify-between rounded-3xl px-4 py-2 dark:bg-Neutrals/neutrals-12',
        collapsed && 'sm:hidden'
      )}
    >
      <aside className="flex justify-center items-center gap-2">
        <Avatar>
          <AvatarImage src={avatarUrl} />
          <AvatarFallback>
            <CypressProfileIcon />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-muted-foreground">
            {isPro ? 'Pro Plan' : 'Free Plan'}
          </span>
          <small
            className="w-[100px] 
          overflow-hidden 
          overflow-ellipsis
          "
          >
            {user.email ?? ''}
          </small>
        </div>
      </aside>
      <div className="flex items-center justify-center gap-2">
        <NotificationBell />
        <LogoutButton>
          <LogOut />
        </LogoutButton>
        <ModeToggle />
      </div>
    </article>
  );
};

export default UserCard;
