'use client';

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Wifi, WifiOff, Settings, Share2, CheckCircle, Clock, AlertCircle, LogIn } from 'lucide-react';
import { useCollaborationState } from '@/hooks/use-collaboration-state';
import { useCollaboration } from '@/lib/providers/collaboration-provider';
import { useToast } from '@/components/ui/use-toast';
import { useState } from 'react';

interface CollaborationIndicatorProps {
  fileId?: string;
  workspaceId?: string;
  onStartCollaboration?: () => void;
  onStopCollaboration?: () => void;
}

export const CollaborationIndicator: React.FC<CollaborationIndicatorProps> = ({
  fileId,
  workspaceId,
  onStartCollaboration,
  onStopCollaboration,
}) => {
  const { toast } = useToast();
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');
  
  const {
    isCollaborating,
    isConnected,
    roomId,
    collaborators,
    startCollaboration,
    stopCollaboration,
  } = useCollaborationState(fileId, workspaceId);
  
  const collaboration = useCollaboration();

  const handleStartCollaboration = async () => {
    if (fileId && workspaceId) {
      try {
        await startCollaboration(fileId, workspaceId);
        onStartCollaboration?.();
        toast({
          title: "Live session started",
          description: "You're now live and can collaborate with others",
        });
      } catch (error) {
        console.error('Failed to start collaboration:', error);
        toast({
          title: "Failed to start live session",
          description: "Please try again",
          variant: "destructive",
        });
      }
    }
  };

  const handleStopCollaboration = async () => {
    try {
      await stopCollaboration();
      onStopCollaboration?.();
      toast({
        title: "Live session stopped",
        description: "You're no longer live",
      });
    } catch (error) {
      console.error('Failed to stop collaboration:', error);
      toast({
        title: "Failed to stop live session",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleCopyRoomId = async () => {
    if (roomId) {
      try {
        await navigator.clipboard.writeText(roomId);
        setCopiedRoomId(true);
        toast({
          title: "Room ID copied",
          description: "Share this ID with others to let them join",
        });
        setTimeout(() => setCopiedRoomId(false), 2000);
      } catch (error) {
        toast({
          title: "Failed to copy",
          description: "Please copy the room ID manually",
          variant: "destructive",
        });
      }
    }
  };

  const handleJoinRoom = async () => {
    if (!roomIdInput.trim()) {
      toast({
        title: "Room ID required",
        description: "Please enter a valid room ID",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Joining room",
        description: `Attempting to join room: ${roomIdInput}`,
      });
      
      await collaboration.joinRoom(roomIdInput.trim());
      
      toast({
        title: "Room joined successfully",
        description: "You are now connected to the collaboration room",
      });
      
      setIsJoinDialogOpen(false);
      setRoomIdInput('');
    } catch (error) {
      console.error('Failed to join room:', error);
      toast({
        title: "Failed to join room",
        description: "Please check the room ID and try again",
        variant: "destructive",
      });
    }
  };

  const getStatusInfo = () => {
    if (isCollaborating && isConnected) {
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        text: 'Live',
        variant: 'default' as const,
      };
    }
    
    if (isCollaborating && !isConnected) {
      return {
        icon: Clock,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        text: 'Connecting...',
        variant: 'secondary' as const,
      };
    }
    
    return {
      icon: AlertCircle,
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
      text: 'Offline',
      variant: 'outline' as const,
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  const activeCollaborators = collaborators.filter(c => c.isActive).length;

  return (
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      <Badge
        variant={statusInfo.variant}
        className={`${statusInfo.bgColor} ${statusInfo.color} border-0`}
      >
        <StatusIcon className="w-3 h-3 mr-1" />
        {statusInfo.text}
      </Badge>

      {/* Collaborators count */}
      {isCollaborating && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{activeCollaborators}</span>
        </div>
      )}

      {/* Collaborator avatars */}
      {isCollaborating && collaborators.length > 0 && (
        <div className="flex -space-x-2">
          {collaborators.slice(0, 3).map((collaborator) => (
            <Avatar key={collaborator.userId} className="w-6 h-6 border-2 border-background">
              <AvatarImage src={collaborator.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {collaborator.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {collaborators.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
              <span className="text-xs text-muted-foreground">+{collaborators.length - 3}</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {!isCollaborating ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartCollaboration}
            className="h-8 px-3 text-xs"
            disabled={!fileId || !workspaceId}
          >
            <Wifi className="w-3 h-3 mr-1" />
            Start Live
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleStopCollaboration}
              className="h-8 px-3 text-xs"
            >
              <WifiOff className="w-3 h-3 mr-1" />
              Stop Live
            </Button>
            
            {/* Share dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Settings className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleCopyRoomId} disabled={!roomId}>
                  {copiedRoomId ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                      Room ID Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      Copy Room ID
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsJoinDialogOpen(true)}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Join Room
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Users className="w-4 h-4 mr-2" />
                  Invite Collaborators
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Join Room Dialog */}
      <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roomId">Room ID</Label>
              <Input
                id="roomId"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                placeholder="Enter room ID"
                className="w-full"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsJoinDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleJoinRoom}>
                Join Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
