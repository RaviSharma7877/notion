import { useEffect, useRef, useCallback } from 'react';
import { useCollaboration } from '@/lib/providers/collaboration-provider';
import { useToast } from '@/components/ui/use-toast';

interface ReconnectionConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetryDelay: number;
}

const DEFAULT_CONFIG: ReconnectionConfig = {
  maxRetries: 5,
  retryDelay: 1000, // 1 second
  backoffMultiplier: 1.5,
  maxRetryDelay: 30000, // 30 seconds
};

export const useCollaborationReconnection = (
  fileId?: string,
  workspaceId?: string,
  config: Partial<ReconnectionConfig> = {}
) => {
  const collaboration = useCollaboration();
  const { toast } = useToast();
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef(false);
  
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Clear retry timeout
  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Calculate retry delay with exponential backoff
  const getRetryDelay = useCallback((attempt: number): number => {
    const delay = finalConfig.retryDelay * Math.pow(finalConfig.backoffMultiplier, attempt);
    return Math.min(delay, finalConfig.maxRetryDelay);
  }, [finalConfig]);

  // Attempt reconnection
  const attemptReconnection = useCallback(async () => {
    if (isReconnectingRef.current || !fileId || !workspaceId) {
      return;
    }

    isReconnectingRef.current = true;
    retryCountRef.current++;

    try {
      await collaboration.startCollaboration(fileId, workspaceId);
      
      // Success - reset retry count
      retryCountRef.current = 0;
      isReconnectingRef.current = false;
      
      toast({
        title: "Reconnected",
        description: "Successfully reconnected to collaboration session",
      });
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
      isReconnectingRef.current = false;
      
      // Check if we should retry
      if (retryCountRef.current < finalConfig.maxRetries) {
        const delay = getRetryDelay(retryCountRef.current);
        
        toast({
          title: "Reconnection Failed",
          description: `Attempt ${retryCountRef.current}/${finalConfig.maxRetries}. Retrying in ${Math.round(delay / 1000)}s...`,
          variant: "destructive",
        });
        
        retryTimeoutRef.current = setTimeout(() => {
          attemptReconnection();
        }, delay);
      } else {
        // Max retries reached
        retryCountRef.current = 0;
        toast({
          title: "Connection Lost",
          description: "Unable to reconnect to collaboration session. Please try again manually.",
          variant: "destructive",
        });
      }
    }
  }, [collaboration, fileId, workspaceId, finalConfig, getRetryDelay, toast]);

  // Handle disconnection
  useEffect(() => {
    if (collaboration.state === 'disconnected' && !isReconnectingRef.current) {
      // Only attempt reconnection if we were previously connected
      if (retryCountRef.current === 0) {
        attemptReconnection();
      }
    }
  }, [collaboration.state, attemptReconnection]);

  // Handle successful connection
  useEffect(() => {
    if (collaboration.state === 'connected') {
      clearRetryTimeout();
      retryCountRef.current = 0;
      isReconnectingRef.current = false;
    }
  }, [collaboration.state, clearRetryTimeout]);

  // Manual reconnection
  const manualReconnect = useCallback(() => {
    clearRetryTimeout();
    retryCountRef.current = 0;
    isReconnectingRef.current = false;
    attemptReconnection();
  }, [clearRetryTimeout, attemptReconnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRetryTimeout();
    };
  }, [clearRetryTimeout]);

  return {
    isReconnecting: isReconnectingRef.current,
    retryCount: retryCountRef.current,
    maxRetries: finalConfig.maxRetries,
    manualReconnect,
  };
};
