'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useNotifications } from './notification-provider';
import { Bell, Users, Wifi, AlertTriangle, Info } from 'lucide-react';

export const NotificationDemo = () => {
  const { addNotification } = useNotifications();

  const demoNotifications = [
    {
      type: 'collaboration' as const,
      title: 'User joined collaboration',
      message: 'John Doe joined the live session',
      icon: Users,
    },
    {
      type: 'room' as const,
      title: 'Room created',
      message: 'New collaboration room created successfully',
      icon: Wifi,
    },
    {
      type: 'presence' as const,
      title: 'User left',
      message: 'Jane Smith left the collaboration',
      icon: Users,
    },
    {
      type: 'error' as const,
      title: 'Connection lost',
      message: 'Failed to maintain collaboration connection',
      icon: AlertTriangle,
    },
    {
      type: 'info' as const,
      title: 'System update',
      message: 'Collaboration features have been updated',
      icon: Info,
    },
  ];

  const handleAddNotification = (notification: typeof demoNotifications[0]) => {
    addNotification({
      type: notification.type,
      title: notification.title,
      message: notification.message,
      actions: notification.type === 'error' ? [
        {
          label: 'Retry',
          action: () => console.log('Retry clicked'),
          variant: 'outline' as const,
        },
        {
          label: 'Dismiss',
          action: () => console.log('Dismiss clicked'),
          variant: 'ghost' as const,
        },
      ] : undefined,
    });
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Notification Demo</h3>
      <p className="text-sm text-muted-foreground">
        Click the buttons below to test different notification types:
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {demoNotifications.map((notification, index) => {
          const Icon = notification.icon;
          return (
            <Button
              key={index}
              variant="outline"
              onClick={() => handleAddNotification(notification)}
              className="flex items-center gap-2 justify-start"
            >
              <Icon className="h-4 w-4" />
              {notification.title}
            </Button>
          );
        })}
      </div>
      
      <div className="pt-4 border-t">
        <Button
          variant="destructive"
          onClick={() => {
            addNotification({
              type: 'error',
              title: 'Critical Error',
              message: 'This is a critical error that requires immediate attention',
              actions: [
                {
                  label: 'View Details',
                  action: () => console.log('View details clicked'),
                  variant: 'default' as const,
                },
                {
                  label: 'Contact Support',
                  action: () => console.log('Contact support clicked'),
                  variant: 'outline' as const,
                },
              ],
            });
          }}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Critical Error Demo
        </Button>
      </div>
    </div>
  );
};
