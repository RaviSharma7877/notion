'use client';

import { NotificationDemo } from '@/components/notifications/notification-demo';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/components/notifications/notification-provider';
import { Bell, Users, Wifi, AlertTriangle, Info } from 'lucide-react';

export default function TestNotificationsPage() {
  const { notifications, unreadCount, clearAll, markAllAsRead } = useNotifications();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notification System Demo</h1>
            <p className="text-muted-foreground mt-2">
              Test the notification system for your collaboration features
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {unreadCount} unread notifications
            </div>
            <NotificationBell />
            <Button variant="outline" onClick={markAllAsRead}>
              Mark all read
            </Button>
            <Button variant="outline" onClick={clearAll}>
              Clear all
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Quick Test</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  useNotifications().addNotification({
                    type: 'collaboration',
                    title: 'User joined',
                    message: 'John Doe joined the collaboration',
                  });
                }}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                User joined
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  useNotifications().addNotification({
                    type: 'room',
                    title: 'Room created',
                    message: 'New collaboration room created',
                  });
                }}
                className="flex items-center gap-2"
              >
                <Wifi className="h-4 w-4" />
                Room created
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  useNotifications().addNotification({
                    type: 'error',
                    title: 'Connection lost',
                    message: 'Failed to maintain connection',
                    actions: [
                      {
                        label: 'Retry',
                        action: () => console.log('Retry clicked'),
                        variant: 'outline',
                      },
                    ],
                  });
                }}
                className="flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Error
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  useNotifications().addNotification({
                    type: 'info',
                    title: 'System update',
                    message: 'Collaboration features updated',
                  });
                }}
                className="flex items-center gap-2"
              >
                <Info className="h-4 w-4" />
                Info
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Current Notifications</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2" />
                  No notifications yet
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border ${
                      notification.read ? 'bg-muted/50' : 'bg-background'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        notification.read ? 'bg-muted-foreground' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                          <span className="text-xs text-muted-foreground">
                            {new Date(notification.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="border-t pt-8">
          <NotificationDemo />
        </div>
      </div>
    </div>
  );
}
