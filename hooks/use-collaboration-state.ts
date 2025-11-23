import { useState, useCallback, useRef, useEffect } from 'react';
import { useCollaboration } from '@/lib/providers/collaboration-provider';
import { CursorPosition, SelectionRange } from '@/lib/queries';

export interface CollaborationState {
  // Connection state
  isCollaborating: boolean;
  isConnected: boolean;
  
  // Room info
  roomId: string | null;
  
  // Presence
  collaborators: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    isActive: boolean;
    lastSeen: number;
  }>;
  
  // Cursors and selections
  cursors: Map<string, CursorPosition>;
  selections: Map<string, SelectionRange>;
  
  // CRDT state
  localClock: number;
  pendingOperations: any[];
  
  // Actions
  startCollaboration: (fileId: string, workspaceId: string) => Promise<void>;
  stopCollaboration: () => Promise<void>;
  updateCursor: (pos: CursorPosition) => void;
  updateSelection: (range: SelectionRange) => void;
  sendCrdtUpdate: (update: string) => void;
  sendOperation: (ops: any[], baseVersion: number) => void;
}

export const useCollaborationState = (fileId?: string, workspaceId?: string) => {
  const collaboration = useCollaboration();
  
  // Local state
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [selections, setSelections] = useState<Map<string, SelectionRange>>(new Map());
  
  // Debounce refs
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounce delay
  const DEBOUNCE_DELAY = 50; // 50ms debounce for cursor/selection updates

  // Update cursors from collaboration context
  useEffect(() => {
    setCursors(new Map(collaboration.cursorMap));
  }, [collaboration.cursorMap]);

  // Update selections from collaboration context
  useEffect(() => {
    setSelections(new Map(collaboration.selectionMap));
  }, [collaboration.selectionMap]);

  // Process pending operations
  useEffect(() => {
    if (collaboration.pendingOps.length > 0) {
      // Process pending operations here
      // This would typically involve applying CRDT or OT operations to the document
      console.log('Processing pending operations:', collaboration.pendingOps);
      
      // Clear processed operations
      // Note: In a real implementation, you'd want to track which operations have been processed
    }
  }, [collaboration.pendingOps]);

  // Start collaboration
  const startCollaboration = useCallback(async (targetFileId: string, targetWorkspaceId: string) => {
    try {
      await collaboration.startCollaboration(targetFileId, targetWorkspaceId);
      setIsCollaborating(true);
    } catch (error) {
      console.error('Failed to start collaboration:', error);
      throw error;
    }
  }, [collaboration]);

  // Stop collaboration
  const stopCollaboration = useCallback(async () => {
    try {
      await collaboration.stopCollaboration();
      setIsCollaborating(false);
      setCursors(new Map());
      setSelections(new Map());
    } catch (error) {
      console.error('Failed to stop collaboration:', error);
      throw error;
    }
  }, [collaboration]);

  // Update cursor with debouncing
  const updateCursor = useCallback((pos: CursorPosition) => {
    // Clear existing timeout
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current);
    }
    
    // Set new timeout
    cursorTimeoutRef.current = setTimeout(() => {
      collaboration.sendCursor(pos);
    }, DEBOUNCE_DELAY);
  }, [collaboration]);

  // Update selection with debouncing
  const updateSelection = useCallback((range: SelectionRange) => {
    // Clear existing timeout
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }
    
    // Set new timeout
    selectionTimeoutRef.current = setTimeout(() => {
      collaboration.sendSelection(range);
    }, DEBOUNCE_DELAY);
  }, [collaboration]);

  // Send CRDT update
  const sendCrdtUpdate = useCallback((update: string) => {
    const newClock = collaboration.localClock + 1;
    collaboration.sendCrdtUpdate(update, newClock);
  }, [collaboration]);

  // Send operation
  const sendOperation = useCallback((ops: any[], baseVersion: number) => {
    const opId = Math.random().toString(36).substr(2, 9);
    collaboration.sendOp(ops, baseVersion, opId);
  }, [collaboration]);

  // Process collaborators from presence data
  const collaborators = collaboration.presence.map(p => ({
    userId: p.userId,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isActive: p.status === 'join' || p.status === 'heartbeat',
    lastSeen: p.at,
  }));

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  // Auto-start collaboration if fileId and workspaceId are provided
  useEffect(() => {
    if (fileId && workspaceId && !isCollaborating && !collaboration.isConnected) {
      startCollaboration(fileId, workspaceId).catch(console.error);
    }
  }, [fileId, workspaceId, isCollaborating, collaboration.isConnected, startCollaboration]);

  return {
    isCollaborating: isCollaborating,
    isConnected: collaboration.isConnected,
    roomId: collaboration.roomInfo?.roomId || null,
    collaborators,
    cursors,
    selections,
    localClock: collaboration.localClock,
    pendingOperations: collaboration.pendingOps,
    startCollaboration,
    stopCollaboration,
    updateCursor,
    updateSelection,
    sendCrdtUpdate,
    sendOperation,
  };
};
