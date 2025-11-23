'use client';

import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { useNotifications } from './notification-provider';

export const NotificationToaster = () => {
  const { notifications } = useNotifications();

  return (
    <>
      <Toaster />
      {/* Custom notification overlay for important notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications
          .filter(n => n.type === 'error' && !n.read)
          .slice(0, 3) // Show max 3 error notifications
          .map(notification => (
            <div
              key={notification.id}
              className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-sm"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-red-800">
                    {notification.title}
                  </h4>
                  <p className="text-sm text-red-600 mt-1">
                    {notification.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
      </div>
    </>
  );
};
