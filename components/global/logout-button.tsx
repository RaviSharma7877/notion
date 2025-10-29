'use client';
import { useAppState } from '@/lib/providers/state-provider';
import { useAuth } from '@/lib/providers/auth-provider';
import { useRouter } from 'next/navigation';
import React from 'react';
import { Button } from '../ui/button';

interface LogoutButtonProps {
  children: React.ReactNode;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ children }) => {
  const { logout } = useAuth();
  const { dispatch } = useAppState();
  const router = useRouter();
  const handleLogout = async () => {
    await logout();
    dispatch({ type: 'SET_WORKSPACES', payload: { workspaces: [] } });
    router.replace('/login');
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      className="p-0"
      onClick={handleLogout}
    >
      {children}
    </Button>
  );
};

export default LogoutButton;
