'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useNotifications } from '@/components/notifications/notification-provider';
import { useCollaboration } from '@/lib/providers/collaboration-provider';
import { useAuth } from '@/lib/providers/auth-provider';

export const useCollaborationNotifications = () => {
  const { addNotification } = useNotifications();
  const { 
    state, 
    isConnected, 
    roomInfo, 
    presence, 
    startCollaboration, 
    stopCollaboration 
  } = useCollaboration();
  const { user } = useAuth();

  // Track previous states for comparison
  const prevStateRef = useRef(state);
  const prevConnectedRef = useRef(isConnected);
  const prevPresenceCountRef = useRef(presence.length);

  // Connection state notifications
  useEffect(() => {
    if (prevStateRef.current !== state) {
      switch (state) {
        case 'connected':
          addNotification({
            type: 'collaboration',
            title: 'Connected to collaboration',
            message: 'You are now live and can collaborate with others',
          });
          break;
        case 'disconnected':
          addNotification({
            type: 'error',
            title: 'Collaboration disconnected',
            message: 'Connection lost. Attempting to reconnect...',
            actions: [
              {
                label: 'Reconnect',
                action: () => {
                  if (roomInfo) {
                    startCollaboration(roomInfo.roomId, '');
                  }
                },
                variant: 'default',
              },
            ],
          });
          break;
        case 'connecting':
          addNotification({
            type: 'info',
            title: 'Connecting...',
            message: 'Establishing collaboration connection',
          });
          break;
      }
    }
    prevStateRef.current = state;
  }, [state, addNotification, roomInfo, startCollaboration]);

  // Presence change notifications
  useEffect(() => {
    const currentPresenceCount = presence.length;
    const prevPresenceCount = prevPresenceCountRef.current;

    if (prevPresenceCount !== currentPresenceCount && prevPresenceCount > 0) {
      if (currentPresenceCount > prevPresenceCount) {
        // Someone joined
        const newUsers = presence.slice(prevPresenceCount);
        newUsers.forEach(user => {
          addNotification({
            type: 'presence',
            title: 'User joined',
            message: `${user.displayName} joined the collaboration`,
          });
        });
      } else if (currentPresenceCount < prevPresenceCount) {
        // Someone left
        addNotification({
          type: 'presence',
          title: 'User left',
          message: 'A collaborator left the session',
        });
      }
    }

    prevPresenceCountRef.current = currentPresenceCount;
  }, [presence, addNotification]);

  // Room creation/joining notifications
  const notifyRoomCreated = useCallback((roomId: string) => {
    addNotification({
      type: 'room',
      title: 'Room created',
      message: `Collaboration room created successfully`,
      data: { roomId },
    });
  }, [addNotification]);

  const notifyRoomJoined = useCallback((roomId: string) => {
    addNotification({
      type: 'room',
      title: 'Joined room',
      message: `You joined the collaboration room`,
      data: { roomId },
    });
  }, [addNotification]);

  const notifyRoomLeft = useCallback(() => {
    addNotification({
      type: 'room',
      title: 'Left room',
      message: 'You have left the collaboration room',
    });
  }, [addNotification]);

  const notifyError = useCallback((error: string) => {
    addNotification({
      type: 'error',
      title: 'Collaboration error',
      message: error,
      actions: [
        {
          label: 'Retry',
          action: () => {
            if (roomInfo) {
              startCollaboration(roomInfo.roomId, '');
            }
          },
          variant: 'outline',
        },
      ],
    });
  }, [addNotification, roomInfo, startCollaboration]);

  return {
    notifyRoomCreated,
    notifyRoomJoined,
    notifyRoomLeft,
    notifyError,
  };
};
