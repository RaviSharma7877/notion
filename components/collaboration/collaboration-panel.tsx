'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Wifi, 
  WifiOff, 
  Users, 
  Share2, 
  Copy, 
  Check, 
  Settings, 
  UserPlus,
  Globe,
  Lock,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useCollaborationState } from '@/hooks/use-collaboration-state';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface CollaborationPanelProps {
  fileId?: string;
  workspaceId?: string;
  className?: string;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  fileId,
  workspaceId,
  className = '',
}) => {
  const { toast } = useToast();
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [copiedRoomId, setCopiedRoomId] = useState(false);
  
  const {
    isCollaborating,
    isConnected,
    roomId,
    collaborators,
    startCollaboration,
    stopCollaboration,
  } = useCollaborationState(fileId, workspaceId);

  const handleStartCollaboration = async () => {
    if (fileId && workspaceId) {
      try {
        await startCollaboration(fileId, workspaceId);
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
    if (roomIdInput.trim()) {
      try {
        // This would need to be implemented in your backend
        // For now, we'll just show a message
        toast({
          title: "Join room functionality",
          description: "This feature will be implemented with your backend",
        });
        setIsJoinDialogOpen(false);
        setRoomIdInput('');
      } catch (error) {
        toast({
          title: "Failed to join room",
          description: "Please check the room ID and try again",
          variant: "destructive",
        });
      }
    }
  };

  const getStatusInfo = () => {
    if (isConnected) {
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        text: 'Live',
        variant: 'default' as const,
      };
    }
    
    if (isCollaborating) {
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
    <div className={`space-y-4 ${className}`}>
      {/* Main collaboration card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Collaboration</CardTitle>
            <Badge
              variant={statusInfo.variant}
              className={`${statusInfo.bgColor} ${statusInfo.color} border-0`}
            >
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.text}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Status and collaborators */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {activeCollaborators} active collaborator{activeCollaborators !== 1 ? 's' : ''}
              </span>
            </div>
            
            {isCollaborating && roomId && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Room ID:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{roomId.slice(0, 8)}...</code>
              </div>
            )}
          </div>

          {/* Collaborator avatars */}
          {isCollaborating && collaborators.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Active now:</span>
              <div className="flex -space-x-2">
                {collaborators.slice(0, 5).map((collaborator) => (
                  <Avatar key={collaborator.userId} className="w-8 h-8 border-2 border-background">
                    <AvatarImage src={collaborator.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {collaborator.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {collaborators.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">+{collaborators.length - 5}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isCollaborating ? (
              <Button
                onClick={handleStartCollaboration}
                className="flex-1"
                disabled={!fileId || !workspaceId}
              >
                <Wifi className="w-4 h-4 mr-2" />
                Start Live Session
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleStopCollaboration}
                className="flex-1"
              >
                <WifiOff className="w-4 h-4 mr-2" />
                Stop Live Session
              </Button>
            )}
            
            {/* Share button */}
            {isCollaborating && roomId && (
              <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Share Room</DialogTitle>
                    <DialogDescription>
                      Share this room ID with others to let them join your collaboration session.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input
                        value={roomId}
                        readOnly
                        className="font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={handleCopyRoomId}
                        variant={copiedRoomId ? "default" : "outline"}
                      >
                        {copiedRoomId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>• Share this room ID with others</p>
                      <p>• They can join using the "Join Room" option</p>
                      <p>• Room will be active as long as you're live</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Join room section */}
          {!isCollaborating && (
            <div className="pt-2 border-t">
              <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Join Existing Room
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join Room</DialogTitle>
                    <DialogDescription>
                      Enter a room ID to join an existing collaboration session.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Room ID</label>
                      <Input
                        placeholder="Enter room ID..."
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleJoinRoom}
                        disabled={!roomIdInput.trim()}
                        className="flex-1"
                      >
                        Join Room
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsJoinDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Room info */}
          {isCollaborating && roomId && (
            <div className="pt-2 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Room Status</span>
                <div className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-green-500" />
                  <span className="text-green-500">Public</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Security</span>
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-green-500" />
                  <span className="text-green-500">Secure</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      {isCollaborating && collaborators.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {collaborators
                .filter(c => !c.isActive)
                .sort((a, b) => b.lastSeen - a.lastSeen)
                .slice(0, 3)
                .map((collaborator) => (
                  <div key={collaborator.userId} className="flex items-center gap-2 text-sm">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={collaborator.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {collaborator.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <span className="font-medium">{collaborator.displayName}</span>
                      <span className="text-muted-foreground ml-2">
                        was active {formatDistanceToNow(new Date(collaborator.lastSeen), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
