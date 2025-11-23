// Shared room storage for collaboration API routes
// In production, this would be replaced with a database

interface Room {
  roomId: string;
  wsUrl: string;
  joinToken: string;
  expiresAt: string;
  fileId: string;
  workspaceId: string;
  createdBy: string;
  createdAt: string;
  participants: Set<string>;
}

const rooms = new Map<string, Room>();

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function setRoom(roomId: string, room: Room): void {
  rooms.set(roomId, room);
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
}

export function getAllRooms(): Room[] {
  return Array.from(rooms.values());
}

export function getRoomsByFileId(fileId: string): Room[] {
  return Array.from(rooms.values()).filter(room => room.fileId === fileId);
}

export function getRoomsByWorkspaceId(workspaceId: string): Room[] {
  return Array.from(rooms.values()).filter(room => room.workspaceId === workspaceId);
}

export function cleanupExpiredRooms(): void {
  const now = new Date();
  for (const [roomId, room] of rooms.entries()) {
    if (new Date(room.expiresAt) < now) {
      rooms.delete(roomId);
    }
  }
}

// Cleanup expired rooms every hour
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredRooms, 60 * 60 * 1000); // 1 hour
}
