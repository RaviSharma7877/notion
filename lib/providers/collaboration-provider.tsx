'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { useAuth } from '@/lib/providers/auth-provider';
import { 
  RoomInfo, 
  PresenceUser, 
  CursorPosition, 
  SelectionRange, 
  CollaborationMessage,
  createRoom,
  joinRoom as joinRoomAPI,
  leaveRoom,
  getBootstrapData
} from '@/lib/queries';
import { useNotifications } from '@/components/notifications/notification-provider';
import { resolveWorkspaceOwnerId } from '@/lib/auth/user';

type CollaborationState = 'idle' | 'requesting_room' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface CollaborationContextType {
  // Connection state
  state: CollaborationState;
  isConnected: boolean;
  
  // Room info
  roomInfo: RoomInfo | null;
  
  // Presence data
  presence: PresenceUser[];
  
  // Cursor and selection data
  cursorMap: Map<string, CursorPosition>;
  selectionMap: Map<string, SelectionRange>;
  
  // CRDT state
  localClock: number;
  pendingOps: CollaborationMessage[];
  
  // Actions
  startCollaboration: (fileId: string, workspaceId: string) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  stopCollaboration: () => Promise<void>;
  sendPresence: (status: 'join' | 'leave' | 'heartbeat') => void;
  sendCursor: (pos: CursorPosition) => void;
  sendSelection: (range: SelectionRange) => void;
  sendCrdtUpdate: (update: string, clock: number) => void;
  sendOp: (ops: any[], baseVersion: number, opId: string) => void;
  
  // Bootstrap
  bootstrapData: any | null;
  loadBootstrap: (fileId: string) => Promise<void>;
}

const CollaborationContext = createContext<CollaborationContextType>({
  state: 'idle',
  isConnected: false,
  roomInfo: null,
  presence: [],
  cursorMap: new Map(),
  selectionMap: new Map(),
  localClock: 0,
  pendingOps: [],
  startCollaboration: async () => {},
  joinRoom: async () => {},
  stopCollaboration: async () => {},
  sendPresence: () => {},
  sendCursor: () => {},
  sendSelection: () => {},
  sendCrdtUpdate: () => {},
  sendOp: () => {},
  bootstrapData: null,
  loadBootstrap: async () => {},
});

export const useCollaboration = () => {
  return useContext(CollaborationContext);
};

export const CollaborationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  
  // State
  const [state, setState] = useState<CollaborationState>('idle');
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [bootstrapData, setBootstrapData] = useState<any | null>(null);
  const [localClock, setLocalClock] = useState(0);
  const [pendingOps, setPendingOps] = useState<CollaborationMessage[]>([]);
  
  // Refs
  const clientRef = useRef<Client | null>(null);
  const subscriptionRef = useRef<StompSubscription | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cursorMapRef = useRef<Map<string, CursorPosition>>(new Map());
  const selectionMapRef = useRef<Map<string, SelectionRange>>(new Map());
  const userIdentifier = user
    ? resolveWorkspaceOwnerId(user) ?? (typeof user.id === 'string' ? user.id : undefined)
    : undefined;

  // Helper function to convert HTTP/HTTPS URL to WebSocket URL
  const convertToWebSocketUrl = (url: string): string => {
    if (url.startsWith('https://')) {
      return url.replace('https://', 'wss://');
    } else if (url.startsWith('http://')) {
      return url.replace('http://', 'ws://');
    }
    return url; // Already a WebSocket URL
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up collaboration...');
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    
    if (clientRef.current) {
      clientRef.current.deactivate();
      clientRef.current = null;
    }
    
    setState('idle');
    setRoomInfo(null);
    setPresence([]);
    setBootstrapData(null);
    setPendingOps([]);
    cursorMapRef.current.clear();
    selectionMapRef.current.clear();
  }, []);

  // Load bootstrap data
  const loadBootstrap = useCallback(async (fileId: string) => {
    try {
      const data = await getBootstrapData(fileId);
      setBootstrapData(data);
    } catch (error) {
      console.error('Failed to load bootstrap data:', error);
      throw error;
    }
  }, []);

  // Send presence message
  const sendPresence = useCallback((status: 'join' | 'leave' | 'heartbeat') => {
    if (!clientRef.current || !clientRef.current.connected || !roomInfo || !userIdentifier) {
      return;
    }

    const message: CollaborationMessage = {
      type: 'presence',
      userId: userIdentifier,
      status,
      at: Date.now(),
    };

    try {
      clientRef.current.publish({
        destination: `/topic/rooms.${roomInfo.roomId}`,
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('Failed to send presence message:', error);
    }
  }, [roomInfo, userIdentifier]);

  // Send cursor position
  const sendCursor = useCallback((pos: CursorPosition) => {
    if (!clientRef.current || !clientRef.current.connected || !roomInfo || !userIdentifier) {
      return;
    }

    const message: CollaborationMessage = {
      type: 'cursor',
      userId: userIdentifier,
      pos,
      at: Date.now(),
    };

    try {
      clientRef.current.publish({
        destination: `/topic/rooms.${roomInfo.roomId}`,
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('Failed to send cursor message:', error);
    }
  }, [roomInfo, userIdentifier]);

  // Send selection range
  const sendSelection = useCallback((range: SelectionRange) => {
    if (!clientRef.current || !clientRef.current.connected || !roomInfo || !userIdentifier) {
      return;
    }

    const message: CollaborationMessage = {
      type: 'selection',
      userId: userIdentifier,
      range,
      at: Date.now(),
    };

    try {
      clientRef.current.publish({
        destination: `/topic/rooms.${roomInfo.roomId}`,
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('Failed to send selection message:', error);
    }
  }, [roomInfo, userIdentifier]);

  // Send CRDT update
  const sendCrdtUpdate = useCallback((update: string, clock: number) => {
    if (!clientRef.current || !clientRef.current.connected || !roomInfo || !userIdentifier) {
      return;
    }

    const message: CollaborationMessage = {
      type: 'crdt',
      userId: userIdentifier,
      update,
      clock,
      at: Date.now(),
    };

    try {
      clientRef.current.publish({
        destination: `/topic/rooms.${roomInfo.roomId}`,
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('Failed to send CRDT update:', error);
    }
  }, [roomInfo, userIdentifier]);

  // Send operation
  const sendOp = useCallback((ops: any[], baseVersion: number, opId: string) => {
    if (!clientRef.current || !clientRef.current.connected || !roomInfo || !userIdentifier) {
      return;
    }

    const message: CollaborationMessage = {
      type: 'op',
      userId: userIdentifier,
      ops,
      baseVersion,
      opId,
      at: Date.now(),
    };

    try {
      clientRef.current.publish({
        destination: `/topic/rooms.${roomInfo.roomId}`,
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('Failed to send operation:', error);
    }
  }, [roomInfo, userIdentifier]);

  // Start collaboration
  const startCollaboration = useCallback(async (fileId: string, workspaceId: string) => {
    if (!user || !userIdentifier) {
      console.error('User not authenticated');
      return;
    }

    console.log('Starting collaboration for file:', fileId, 'workspace:', workspaceId);

    try {
      setState('requesting_room');
      
      // Load bootstrap data first
      console.log('Loading bootstrap data...');
      await loadBootstrap(fileId);
      console.log('Bootstrap data loaded successfully');
      
      // Create a new room for collaboration
      console.log('Creating new collaboration room...');
      const room = await createRoom(fileId, workspaceId);
      console.log('Room created successfully:', room.roomId);
      addNotification({
        type: 'room',
        title: 'Room created',
        message: 'New collaboration room created successfully',
      });
      
      setRoomInfo(room);
      setState('connecting');
      
      // Convert URL to WebSocket protocol
      const wsUrl = convertToWebSocketUrl(room.wsUrl);
      console.log('Original URL:', room.wsUrl);
      console.log('WebSocket URL:', wsUrl);
      
      // Initialize STOMP client
      console.log('Initializing STOMP client with URL:', wsUrl);
      const client = new Client({
        brokerURL: wsUrl,
        connectHeaders: {
          Authorization: `Bearer ${room.joinToken}`,
          ...(userIdentifier ? { 'X-User-Id': String(userIdentifier) } : {}),
        },
        onConnect: () => {
          console.log('STOMP connected successfully');
          setState('connected');
          
          addNotification({
            type: 'collaboration',
            title: 'Connected',
            message: 'You are now live and can collaborate with others',
          });
          
          // Subscribe to room messages
          const subscription = client.subscribe(`/topic/rooms.${room.roomId}`, (message: IMessage) => {
            try {
              const data: CollaborationMessage = JSON.parse(message.body);
              console.log('Received collaboration message:', data);
              handleIncomingMessage(data);
            } catch (error) {
              console.error('Failed to parse incoming message:', error);
            }
          });
          
          subscriptionRef.current = subscription;
          
          // Add current user to presence list immediately
          if (user) {
            setPresence(prev => {
              const filtered = prev.filter(p => p.userId !== userIdentifier);
              return [...filtered, {
                userId: userIdentifier,
                displayName: user.fullName || `User ${String(userIdentifier).slice(0, 8)}`,
                avatarUrl: user.avatarUrl || null,
                status: 'join' as const,
                at: Date.now(),
              }];
            });
          }
          
          // Send initial presence after a short delay to ensure connection is stable
          setTimeout(() => {
            console.log('Sending initial presence...');
            sendPresence('join');
          }, 100);
          
          // Start heartbeat
          heartbeatIntervalRef.current = setInterval(() => {
            sendPresence('heartbeat');
          }, 25000); // 25 seconds
        },
        onStompError: (frame) => {
          console.error('STOMP error:', frame);
          setState('error');
          addNotification({
            type: 'error',
            title: 'Connection error',
            message: 'Failed to connect to collaboration server',
          });
        },
        onWebSocketError: (error) => {
          console.error('WebSocket error:', error);
          setState('error');
          addNotification({
            type: 'error',
            title: 'Connection error',
            message: 'Failed to establish WebSocket connection',
          });
        },
      });
      
      clientRef.current = client;
      client.activate();
      
    } catch (error) {
      console.error('Failed to start collaboration:', error);
      setState('error');
      addNotification({
        type: 'error',
        title: 'Failed to start collaboration',
        message: 'Unable to establish collaboration session. Please try again.',
      });
    }
  }, [user, userIdentifier, loadBootstrap, sendPresence, cleanup, addNotification]);

  // Stop collaboration
  const stopCollaboration = useCallback(async () => {
    if (roomInfo) {
      try {
        await leaveRoom(roomInfo.roomId);
        addNotification({
          type: 'room',
          title: 'Left room',
          message: 'You have left the collaboration room',
        });
      } catch (error) {
        console.error('Failed to leave room:', error);
        addNotification({
          type: 'error',
          title: 'Failed to leave room',
          message: 'There was an error leaving the collaboration room',
        });
      }
    }
    
    cleanup();
  }, [roomInfo, cleanup, addNotification]);

  // Handle incoming messages
  const handleIncomingMessage = useCallback((message: CollaborationMessage) => {
    switch (message.type) {
      case 'presence':
        if (message.userId) {
          setPresence(prev => {
            const filtered = prev.filter(p => p.userId !== message.userId);
            if (message.status === 'join' || message.status === 'heartbeat') {
              return [...filtered, {
                userId: String(message.userId),
                displayName: message.userId === user?.id 
                  ? (user?.fullName || `User ${String(message.userId).slice(0, 8)}`)
                  : `User ${String(message.userId).slice(0, 8)}`,
                avatarUrl: message.userId === user?.id ? user?.avatarUrl || null : null,
                status: message.status!,
                at: message.at,
              }];
            }
            return filtered;
          });
        }
        break;
        
      case 'cursor':
        if (message.userId && message.userId !== user?.id && message.pos) {
          cursorMapRef.current.set(message.userId, message.pos);
        }
        break;
        
      case 'selection':
        if (message.userId && message.userId !== user?.id && message.range) {
          selectionMapRef.current.set(message.userId, message.range);
        }
        break;
        
      case 'crdt':
        if (message.userId && message.userId !== user?.id && message.update && message.clock) {
          // Handle CRDT update
          setPendingOps(prev => [...prev, message]);
        }
        break;
        
      case 'op':
        if (message.userId && message.userId !== user?.id && message.ops) {
          // Handle OT operation
          setPendingOps(prev => [...prev, message]);
        }
        break;
        
      case 'system':
        if (message.action === 'room_closed') {
          console.log('Room closed:', message.reason);
          cleanup();
        }
        break;
    }
  }, [user, cleanup]);

  // Join existing room
  const joinRoom = useCallback(async (roomId: string) => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    console.log('Joining room:', roomId);

    try {
      setState('requesting_room');
      
      // Join the existing room
      console.log('Joining existing room...');
      const room = await joinRoomAPI(roomId);
      console.log('Room joined successfully:', room.roomId);
      addNotification({
        type: 'room',
        title: 'Joined room',
        message: 'Successfully joined collaboration room',
      });
      
      setRoomInfo(room);
      setState('connecting');
      
      // Convert URL to WebSocket protocol
      const wsUrl = convertToWebSocketUrl(room.wsUrl);
      console.log('Original URL:', room.wsUrl);
      console.log('WebSocket URL:', wsUrl);
      
      // Initialize STOMP client
      console.log('Initializing STOMP client with URL:', wsUrl);
      const client = new Client({
        brokerURL: wsUrl,
        connectHeaders: {
          Authorization: `Bearer ${room.joinToken}`,
          ...(userIdentifier ? { 'X-User-Id': String(userIdentifier) } : {}),
        },
        onConnect: () => {
          console.log('STOMP connected successfully');
          setState('connected');
          
          addNotification({
            type: 'collaboration',
            title: 'Connected',
            message: 'You are now live and can collaborate with others',
          });
          
          // Subscribe to room messages
          const subscription = client.subscribe(`/topic/rooms.${room.roomId}`, (message: IMessage) => {
            try {
              const data: CollaborationMessage = JSON.parse(message.body);
              console.log('Received collaboration message:', data);
              handleIncomingMessage(data);
            } catch (error) {
              console.error('Failed to parse incoming message:', error);
            }
          });
          
          subscriptionRef.current = subscription;
          
          // Add current user to presence list immediately
          if (user && userIdentifier) {
            setPresence(prev => {
              const filtered = prev.filter(p => p.userId !== userIdentifier);
              return [...filtered, {
                userId: userIdentifier,
                displayName: user.fullName || `User ${String(userIdentifier).slice(0, 8)}`,
                avatarUrl: user.avatarUrl || null,
                status: 'join' as const,
                at: Date.now(),
              }];
            });
          }
          
          // Send initial presence after a short delay to ensure connection is stable
          setTimeout(() => {
            console.log('Sending initial presence...');
            sendPresence('join');
          }, 100);
          
          // Start heartbeat
          heartbeatIntervalRef.current = setInterval(() => {
            sendPresence('heartbeat');
          }, 25000); // 25 seconds
        },
        onStompError: (frame) => {
          console.error('STOMP error:', frame);
          setState('error');
          addNotification({
            type: 'error',
            title: 'Connection error',
            message: 'Failed to connect to collaboration server',
          });
        },
        onWebSocketError: (error) => {
          console.error('WebSocket error:', error);
          setState('error');
          addNotification({
            type: 'error',
            title: 'Connection error',
            message: 'Failed to establish WebSocket connection',
          });
        },
      });
      
      clientRef.current = client;
      client.activate();
      
    } catch (error) {
      console.error('Failed to join room:', error);
      setState('error');
      addNotification({
        type: 'error',
        title: 'Failed to join room',
        message: 'Unable to join collaboration room. Please check the room ID and try again.',
      });
    }
  }, [user, sendPresence, cleanup, addNotification, handleIncomingMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Cleanup on user change
  useEffect(() => {
    if (!user) {
      cleanup();
    }
  }, [user, cleanup]);

  const contextValue: CollaborationContextType = {
    state,
    isConnected: state === 'connected',
    roomInfo,
    presence,
    cursorMap: cursorMapRef.current,
    selectionMap: selectionMapRef.current,
    localClock,
    pendingOps,
    startCollaboration,
    joinRoom,
    stopCollaboration,
    sendPresence,
    sendCursor,
    sendSelection,
    sendCrdtUpdate,
    sendOp,
    bootstrapData,
    loadBootstrap,
  };

  return (
    <CollaborationContext.Provider value={contextValue}>
      {children}
    </CollaborationContext.Provider>
  );
};
