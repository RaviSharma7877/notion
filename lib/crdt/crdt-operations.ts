/**
 * Simple CRDT operations for document synchronization
 * This is a basic implementation - in production, you'd want to use a more robust CRDT library
 */

export interface CRDTOperation {
  id: string;
  type: 'insert' | 'delete' | 'update';
  blockId: string;
  position?: number;
  content?: string;
  timestamp: number;
  clientId: string;
  clock: number;
}

export interface CRDTSnapshot {
  clock: number;
  operations: CRDTOperation[];
  content: string;
}

export class CRDTDocument {
  private operations: Map<string, CRDTOperation> = new Map();
  private clock: number = 0;
  private clientId: string;

  constructor(clientId: string, initialClock: number = 0) {
    this.clientId = clientId;
    this.clock = initialClock;
  }

  // Generate unique operation ID
  private generateId(): string {
    return `${this.clientId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Increment clock and return new value
  private incrementClock(): number {
    this.clock++;
    return this.clock;
  }

  // Insert content at position
  insert(blockId: string, position: number, content: string): CRDTOperation {
    const operation: CRDTOperation = {
      id: this.generateId(),
      type: 'insert',
      blockId,
      position,
      content,
      timestamp: Date.now(),
      clientId: this.clientId,
      clock: this.incrementClock(),
    };

    this.operations.set(operation.id, operation);
    return operation;
  }

  // Delete content at position
  delete(blockId: string, position: number, length: number): CRDTOperation {
    const operation: CRDTOperation = {
      id: this.generateId(),
      type: 'delete',
      blockId,
      position,
      content: '', // For delete operations, content represents the deleted text
      timestamp: Date.now(),
      clientId: this.clientId,
      clock: this.incrementClock(),
    };

    this.operations.set(operation.id, operation);
    return operation;
  }

  // Update block content
  update(blockId: string, content: string): CRDTOperation {
    const operation: CRDTOperation = {
      id: this.generateId(),
      type: 'update',
      blockId,
      content,
      timestamp: Date.now(),
      clientId: this.clientId,
      clock: this.incrementClock(),
    };

    this.operations.set(operation.id, operation);
    return operation;
  }

  // Apply operation from another client
  applyOperation(operation: CRDTOperation): boolean {
    // Check if operation already exists
    if (this.operations.has(operation.id)) {
      return false;
    }

    // Update clock if needed
    if (operation.clock > this.clock) {
      this.clock = operation.clock;
    }

    this.operations.set(operation.id, operation);
    return true;
  }

  // Get all operations
  getOperations(): CRDTOperation[] {
    return Array.from(this.operations.values()).sort((a, b) => {
      // Sort by clock, then by timestamp, then by clientId
      if (a.clock !== b.clock) return a.clock - b.clock;
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.clientId.localeCompare(b.clientId);
    });
  }

  // Get operations for a specific block
  getBlockOperations(blockId: string): CRDTOperation[] {
    return this.getOperations().filter(op => op.blockId === blockId);
  }

  // Get current clock value
  getClock(): number {
    return this.clock;
  }

  // Create snapshot
  createSnapshot(): CRDTSnapshot {
    return {
      clock: this.clock,
      operations: this.getOperations(),
      content: this.serialize(),
    };
  }

  // Serialize operations to string (for transmission)
  serialize(): string {
    return JSON.stringify(this.getOperations());
  }

  // Deserialize operations from string
  deserialize(data: string): void {
    try {
      const operations: CRDTOperation[] = JSON.parse(data);
      operations.forEach(op => this.applyOperation(op));
    } catch (error) {
      console.error('Failed to deserialize CRDT operations:', error);
    }
  }

  // Merge with another CRDT document
  merge(other: CRDTDocument): void {
    const otherOperations = other.getOperations();
    otherOperations.forEach(op => this.applyOperation(op));
  }

  // Get operations since a specific clock value
  getOperationsSince(clock: number): CRDTOperation[] {
    return this.getOperations().filter(op => op.clock > clock);
  }

  // Clear all operations (for reset)
  clear(): void {
    this.operations.clear();
    this.clock = 0;
  }

  // Get operation count
  getOperationCount(): number {
    return this.operations.size;
  }
}

// Utility functions for CRDT operations
export const CRDTUtils = {
  // Create operation from JSON
  fromJSON(data: string): CRDTOperation | null {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  // Convert operation to JSON
  toJSON(operation: CRDTOperation): string {
    return JSON.stringify(operation);
  },

  // Check if operation is valid
  isValid(operation: CRDTOperation): boolean {
    return !!(
      operation.id &&
      operation.type &&
      operation.blockId &&
      typeof operation.timestamp === 'number' &&
      typeof operation.clock === 'number' &&
      operation.clientId
    );
  },

  // Compare operations for ordering
  compare(a: CRDTOperation, b: CRDTOperation): number {
    if (a.clock !== b.clock) return a.clock - b.clock;
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.clientId.localeCompare(b.clientId);
  },

  // Generate client ID
  generateClientId(): string {
    return Math.random().toString(36).substr(2, 9);
  },
};
