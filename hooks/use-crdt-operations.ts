import { useCallback, useRef, useEffect } from 'react';
import { CRDTDocument, CRDTOperation, CRDTSnapshot } from '@/lib/crdt/crdt-operations';
import { useCollaborationState } from './use-collaboration-state';

export interface UseCRDTOperationsReturn {
  // CRDT document
  document: CRDTDocument;
  
  // Operations
  insert: (blockId: string, position: number, content: string) => CRDTOperation | null;
  delete: (blockId: string, position: number, length: number) => CRDTOperation | null;
  update: (blockId: string, content: string) => CRDTOperation | null;
  
  // Sync
  applyRemoteOperation: (operation: CRDTOperation) => boolean;
  getOperationsSince: (clock: number) => CRDTOperation[];
  createSnapshot: () => CRDTSnapshot;
  
  // State
  clock: number;
  operationCount: number;
}

export const useCRDTOperations = (fileId?: string, workspaceId?: string): UseCRDTOperationsReturn => {
  const collaboration = useCollaborationState(fileId, workspaceId);
  const documentRef = useRef<CRDTDocument | null>(null);
  const clientIdRef = useRef<string>(Math.random().toString(36).substr(2, 9));

  // Initialize CRDT document
  useEffect(() => {
    if (!documentRef.current) {
      documentRef.current = new CRDTDocument(clientIdRef.current, collaboration.localClock);
    }
  }, [collaboration.localClock]);

  // Apply remote operations
  useEffect(() => {
    if (collaboration.pendingOperations.length > 0 && documentRef.current) {
      collaboration.pendingOperations.forEach(operation => {
        if (operation.type === 'crdt' && operation.update) {
          try {
            // Parse the update data
            const operations: CRDTOperation[] = JSON.parse(atob(operation.update));
            operations.forEach(op => {
              documentRef.current?.applyOperation(op);
            });
          } catch (error) {
            console.error('Failed to apply remote CRDT operation:', error);
          }
        }
      });
    }
  }, [collaboration.pendingOperations]);

  // Insert operation
  const insert = useCallback((blockId: string, position: number, content: string): CRDTOperation | null => {
    if (!documentRef.current) return null;
    
    const operation = documentRef.current.insert(blockId, position, content);
    
    // Send to collaboration system
    const updateData = btoa(JSON.stringify([operation]));
    collaboration.sendCrdtUpdate(updateData);
    
    return operation;
  }, [collaboration]);

  // Delete operation
  const deleteOp = useCallback((blockId: string, position: number, length: number): CRDTOperation | null => {
    if (!documentRef.current) return null;
    
    const operation = documentRef.current.delete(blockId, position, length);
    
    // Send to collaboration system
    const updateData = btoa(JSON.stringify([operation]));
    collaboration.sendCrdtUpdate(updateData);
    
    return operation;
  }, [collaboration]);

  // Update operation
  const update = useCallback((blockId: string, content: string): CRDTOperation | null => {
    if (!documentRef.current) return null;
    
    const operation = documentRef.current.update(blockId, content);
    
    // Send to collaboration system
    const updateData = btoa(JSON.stringify([operation]));
    collaboration.sendCrdtUpdate(updateData);
    
    return operation;
  }, [collaboration]);

  // Apply remote operation
  const applyRemoteOperation = useCallback((operation: CRDTOperation): boolean => {
    if (!documentRef.current) return false;
    return documentRef.current.applyOperation(operation);
  }, []);

  // Get operations since clock
  const getOperationsSince = useCallback((clock: number): CRDTOperation[] => {
    if (!documentRef.current) return [];
    return documentRef.current.getOperationsSince(clock);
  }, []);

  // Create snapshot
  const createSnapshot = useCallback((): CRDTSnapshot => {
    if (!documentRef.current) {
      return { clock: 0, operations: [], content: '' };
    }
    return documentRef.current.createSnapshot();
  }, []);

  return {
    document: documentRef.current || new CRDTDocument(clientIdRef.current),
    insert,
    delete: deleteOp,
    update,
    applyRemoteOperation,
    getOperationsSince,
    createSnapshot,
    clock: documentRef.current?.getClock() || 0,
    operationCount: documentRef.current?.getOperationCount() || 0,
  };
};
