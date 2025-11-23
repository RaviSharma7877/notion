'use client';

import React from 'react';
import { CollaborationPanel } from '@/components/collaboration/collaboration-panel';
import { CollaborationIndicator } from '@/components/collaboration/collaboration-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export default function CollaborationDemoPage() {
  const [fileId, setFileId] = useState('demo-file-123');
  const [workspaceId, setWorkspaceId] = useState('demo-workspace-456');
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Collaboration Demo</h1>
          <p className="text-muted-foreground">
            Test the new professional collaboration UI with join room and share room functionality
          </p>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fileId">File ID</Label>
                <Input
                  id="fileId"
                  value={fileId}
                  onChange={(e) => setFileId(e.target.value)}
                  placeholder="Enter file ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspaceId">Workspace ID</Label>
                <Input
                  id="workspaceId"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  placeholder="Enter workspace ID"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowPanel(!showPanel)}>
                {showPanel ? 'Hide' : 'Show'} Full Panel
              </Button>
              <Badge variant="outline">
                {showPanel ? 'Panel Mode' : 'Indicator Mode'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Collaboration UI */}
        <Card>
          <CardHeader>
            <CardTitle>Collaboration Interface</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Compact indicator */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Compact Indicator (for toolbar/header)</h3>
              <div className="p-4 border rounded-lg bg-muted/20">
                <CollaborationIndicator 
                  fileId={fileId} 
                  workspaceId={workspaceId}
                  onStartCollaboration={() => console.log('Started collaboration')}
                  onStopCollaboration={() => console.log('Stopped collaboration')}
                />
              </div>
            </div>

            {/* Full panel */}
            {showPanel && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Full Panel (for sidebar/modal)</h3>
                <div className="p-4 border rounded-lg bg-muted/20">
                  <CollaborationPanel 
                    fileId={fileId} 
                    workspaceId={workspaceId}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features showcase */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">✅ Professional UI</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Clean, modern design</li>
                  <li>• Status indicators with proper colors</li>
                  <li>• User avatars and counts</li>
                  <li>• Toast notifications</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">✅ Share & Join Rooms</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Copy room ID to clipboard</li>
                  <li>• Join existing rooms</li>
                  <li>• Real-time presence updates</li>
                  <li>• Connection status tracking</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">✅ Real-time Updates</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• WebSocket connection status</li>
                  <li>• Live collaborator presence</li>
                  <li>• Automatic reconnection</li>
                  <li>• Heartbeat monitoring</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">✅ User Experience</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Intuitive controls</li>
                  <li>• Clear status feedback</li>
                  <li>• Error handling</li>
                  <li>• Responsive design</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">1. Start Live Session</h4>
              <p className="text-sm text-muted-foreground">
                Click "Start Live" to create a new collaboration room. You should see the status change to "Live" 
                and your user appear in the collaborators list.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">2. Share Room</h4>
              <p className="text-sm text-muted-foreground">
                Once live, click the settings icon to access the share menu. Copy the room ID to share with others.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">3. Test Connection</h4>
              <p className="text-sm text-muted-foreground">
                The UI will show real-time connection status. If you see "Connecting..." for too long, 
                check your WebSocket server configuration.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
