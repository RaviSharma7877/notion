'use client';

import React, { useMemo } from 'react';

import { useAuth } from '@/lib/providers/auth-provider';
import type { SubscriptionDto } from '@/lib/queries';

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import CypressProfileIcon from '../icons/cypressProfileIcon';
import ModeToggle from '../global/mode-toggle';
import { LogOut } from 'lucide-react';
import LogoutButton from '../global/logout-button';

interface UserCardProps {
  subscription: SubscriptionDto | null;
}

const UserCard: React.FC<UserCardProps> = ({ subscription }) => {
  const { user, subscription: contextSubscription } = useAuth();

  const activeSubscription = useMemo<SubscriptionDto | null>(() => {
    return subscription ?? contextSubscription ?? null;
  }, [subscription, contextSubscription]);

  if (!user) {
    return null;
  }

  const avatarUrl = user.avatarUrl ?? '';
  const isPro = (activeSubscription?.status ?? '').toUpperCase() === 'ACTIVE';

  return (
    <article
      className="hidden
      sm:flex 
      justify-between 
      items-center 
      px-4 
      py-2 
      dark:bg-Neutrals/neutrals-12
      rounded-3xl
  "
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
      <div className="flex items-center justify-center">
        <LogoutButton>
          <LogOut />
        </LogoutButton>
        <ModeToggle />
      </div>
    </article>
  );
};

export default UserCard;
