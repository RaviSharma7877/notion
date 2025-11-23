'use client';

import React from 'react';
import { Users, Wifi, WifiOff, UserPlus, UserMinus, AlertTriangle, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from './notification-provider';
import { Notification } from './notification-provider';

interface NotificationItemProps {
  notification: Notification;
  timeAgo: string;
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'collaboration':
      return <Users className="h-4 w-4" />;
    case 'room':
      return <Wifi className="h-4 w-4" />;
    case 'presence':
      return <UserPlus className="h-4 w-4" />;
    case 'error':
      return <AlertTriangle className="h-4 w-4" />;
    case 'info':
    default:
      return <Info className="h-4 w-4" />;
  }
};

const getNotificationColor = (type: Notification['type'], read: boolean) => {
  if (read) return 'text-muted-foreground';
  
  switch (type) {
    case 'error':
      return 'text-red-500';
    case 'collaboration':
      return 'text-blue-500';
    case 'room':
      return 'text-green-500';
    case 'presence':
      return 'text-purple-500';
    default:
      return 'text-foreground';
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  timeAgo 
}) => {
  const { markAsRead, removeNotification } = useNotifications();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNotification(notification.id);
  };

  return (
    <div
      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
        !notification.read ? 'bg-blue-50/50 border-l-2 border-l-blue-500' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 ${getNotificationColor(notification.type, notification.read)}`}>
          {getNotificationIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm font-medium ${!notification.read ? 'font-semibold' : ''}`}>
              {notification.title}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {notification.message}
          </p>
          
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex gap-2 mt-2">
              {notification.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.action();
                  }}
                  className="text-xs"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        
        {!notification.read && (
          <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />
        )}
      </div>
    </div>
  );
};
