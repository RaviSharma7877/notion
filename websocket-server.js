const WebSocket = require('ws');
const http = require('http');

// Simple WebSocket server for testing collaboration
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store active rooms and connections
const rooms = new Map();
const connections = new Map();

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  // Extract room ID from URL or headers
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.searchParams.get('roomId') || 'default';
  
  // Store connection
  const connectionId = Math.random().toString(36).substr(2, 9);
  connections.set(connectionId, { ws, roomId });
  
  // Add to room
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(connectionId);
  
  console.log(`Connection ${connectionId} joined room ${roomId}`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    connectionId,
    roomId,
    timestamp: Date.now()
  }));
  
  // Handle messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message:', message);
      
      // Broadcast to all connections in the same room
      const roomConnections = rooms.get(roomId) || new Set();
      roomConnections.forEach(connId => {
        const conn = connections.get(connId);
        if (conn && conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(JSON.stringify({
            ...message,
            timestamp: Date.now()
          }));
        }
      });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`Connection ${connectionId} disconnected`);
    
    // Remove from room
    const roomConnections = rooms.get(roomId);
    if (roomConnections) {
      roomConnections.delete(connectionId);
      if (roomConnections.size === 0) {
        rooms.delete(roomId);
      }
    }
    
    // Remove connection
    connections.delete(connectionId);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.WS_PORT || 8089;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(`Connect to: ws://localhost:${PORT}`);
});
