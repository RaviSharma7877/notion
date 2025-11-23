'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wifi, 
  WifiOff, 
  Users, 
  AlertTriangle, 
  RefreshCw, 
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useCollaborationState } from '@/hooks/use-collaboration-state';
import { useCollaborationReconnection } from '@/hooks/use-collaboration-reconnection';
import { formatDistanceToNow } from 'date-fns';

interface CollaborationStatusProps {
  fileId?: string;
  workspaceId?: string;
  className?: string;
}

export const CollaborationStatus: React.FC<CollaborationStatusProps> = ({
  fileId,
  workspaceId,
  className = '',
}) => {
  const collaboration = useCollaborationState(fileId, workspaceId);
  const { isReconnecting, retryCount, maxRetries, manualReconnect } = useCollaborationReconnection(
    fileId,
    workspaceId
  );

  const getStatusInfo = () => {
    if (isReconnecting) {
      return {
        icon: RefreshCw,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        text: `Reconnecting... (${retryCount}/${maxRetries})`,
        variant: 'secondary' as const,
      };
    }

    if (collaboration.isConnected) {
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        text: 'Live',
        variant: 'default' as const,
      };
    }

    if (collaboration.isCollaborating) {
      return {
        icon: AlertTriangle,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        text: 'Connecting...',
        variant: 'secondary' as const,
      };
    }

    return {
      icon: XCircle,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
      text: 'Offline',
      variant: 'outline' as const,
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Get active collaborators count
  const activeCollaborators = collaboration.collaborators.filter(c => c.isActive).length;
  const totalCollaborators = collaboration.collaborators.length;

  // Get last activity time
  const lastActivity = collaboration.collaborators
    .filter(c => !c.isActive)
    .sort((a, b) => b.lastSeen - a.lastSeen)[0];

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main status */}
      <div className="flex items-center gap-2">
        <Badge
          variant={statusInfo.variant}
          className={`${statusInfo.bgColor} ${statusInfo.color} border-0`}
        >
          <StatusIcon className={`w-3 h-3 mr-1 ${isReconnecting ? 'animate-spin' : ''}`} />
          {statusInfo.text}
        </Badge>

        {/* Collaborator count */}
        {collaboration.isCollaborating && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{activeCollaborators}/{totalCollaborators}</span>
          </div>
        )}
      </div>

      {/* Reconnection status */}
      {isReconnecting && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Attempting to reconnect... ({retryCount}/{maxRetries})
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={manualReconnect}
              className="ml-2"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Connection lost */}
      {!collaboration.isConnected && !isReconnecting && collaboration.isCollaborating && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Connection lost</span>
            <Button
              size="sm"
              variant="outline"
              onClick={manualReconnect}
              className="ml-2"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reconnect
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Collaborators info */}
      {collaboration.isCollaborating && totalCollaborators > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>
              {activeCollaborators} active collaborator{activeCollaborators !== 1 ? 's' : ''}
            </span>
          </div>
          
          {lastActivity && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>
                Last activity: {formatDistanceToNow(new Date(lastActivity.lastSeen), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* CRDT status */}
      {collaboration.isCollaborating && (
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>Clock: {collaboration.localClock}</span>
            {collaboration.pendingOperations.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {collaboration.pendingOperations.length} pending
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
