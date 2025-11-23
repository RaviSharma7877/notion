'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Wifi, WifiOff, Clock } from 'lucide-react';
import { useCollaborationState } from '@/hooks/use-collaboration-state';
import { formatDistanceToNow } from 'date-fns';

interface PresencePanelProps {
  fileId?: string;
  workspaceId?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const PresencePanel: React.FC<PresencePanelProps> = ({
  fileId,
  workspaceId,
  isOpen = false,
  onClose,
}) => {
  const {
    isCollaborating,
    isConnected,
    collaborators,
    startCollaboration,
    stopCollaboration,
  } = useCollaborationState(fileId, workspaceId);

  const handleStartCollaboration = async () => {
    if (fileId && workspaceId) {
      try {
        await startCollaboration(fileId, workspaceId);
      } catch (error) {
        console.error('Failed to start collaboration:', error);
      }
    }
  };

  const handleStopCollaboration = async () => {
    try {
      await stopCollaboration();
    } catch (error) {
      console.error('Failed to stop collaboration:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Collaboration</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <Badge variant={isCollaborating ? 'default' : 'secondary'}>
            {isCollaborating ? 'Live' : 'Offline'}
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isCollaborating ? (
            <Button
              size="sm"
              onClick={handleStartCollaboration}
              className="flex-1"
              disabled={!fileId || !workspaceId}
            >
              <Wifi className="w-4 h-4 mr-2" />
              Start Live Session
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleStopCollaboration}
              className="flex-1"
            >
              <WifiOff className="w-4 h-4 mr-2" />
              Stop Live Session
            </Button>
          )}
        </div>

        {/* Collaborators list */}
        {isCollaborating && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="w-4 h-4" />
              Active Collaborators ({collaborators.length})
            </div>
            
            {collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active collaborators</p>
            ) : (
              <div className="space-y-2">
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.userId}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={collaborator.avatarUrl || undefined} />
                      <AvatarFallback>
                        {collaborator.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {collaborator.displayName}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <div className={`w-1.5 h-1.5 rounded-full ${collaborator.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span>
                          {collaborator.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {!collaborator.isActive && (
                          <>
                            <Clock className="w-3 h-3 ml-1" />
                            <span>
                              {formatDistanceToNow(new Date(collaborator.lastSeen), { addSuffix: true })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
