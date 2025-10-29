'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io as ClientIO, type Socket } from 'socket.io-client';
import { useAuth } from '@/lib/providers/auth-provider';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const socketUrl = (process.env.NEXT_PUBLIC_COLLAB_SOCKET_URL ?? 'http://localhost:9093').replace(/\/$/, '');

  useEffect(() => {
    if (!user?.id) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const socketInstance = ClientIO(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
      auth: {
        userId: user.id,
      },
    });

    const handleConnect = () => {
      setSocket(socketInstance);
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setSocket(null);
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);

    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      socketInstance.disconnect();
      handleDisconnect();
    };
  }, [socketUrl, user?.id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
