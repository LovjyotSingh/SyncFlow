import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';

// Track presence: { documentId: { socketId: { name, color } } }
const presenceMap: Record<string, Record<string, { name: string; color: string }>> = {};

const COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b',
  '#10b981', '#f43f5e', '#3b82f6', '#ec4899',
];

function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function broadcastPresence(io: Server, documentId: string) {
  const users = Object.values(presenceMap[documentId] || {});
  io.to(documentId).emit('presence-update', users);
}

export const setupSocket = (io: Server, redisClient: any) => {
  io.on('connection', (socket: Socket) => {
    console.log(`🟢 User connected: ${socket.id}`);

    let currentDocId: string | null = null;

    // Join a specific document room
    socket.on('join-document', async (documentId: string, userName?: string) => {
      socket.join(documentId);
      currentDocId = documentId;
      console.log(`User ${socket.id} joined document ${documentId}`);

      // Register presence
      if (!presenceMap[documentId]) presenceMap[documentId] = {};
      presenceMap[documentId][socket.id] = {
        name: userName || `Guest ${socket.id.slice(0, 4)}`,
        color: getRandomColor(),
      };
      broadcastPresence(io, documentId);

      // Send the last saved document state to the newly joined user
      try {
        if (redisClient?.isReady) {
          const savedContent = await redisClient.get(`doc:${documentId}`);
          if (savedContent) {
            socket.emit('load-document', JSON.parse(savedContent));
          }
        }
      } catch (err) {
        console.error('Redis load error:', err);
      }
    });

    // Handle document changes
    socket.on('send-changes', async (documentId: string, content: any) => {
      // Broadcast to everyone else in the room
      socket.to(documentId).emit('receive-changes', content);

      // Persist to Redis (non-blocking)
      try {
        if (redisClient?.isReady) {
          await redisClient.set(`doc:${documentId}`, JSON.stringify(content), { EX: 60 * 60 * 24 * 7 });
        }
      } catch (err) {
        // Redis error is non-fatal
      }
    });

    // Handle typing indicator
    socket.on('typing', (documentId: string, isTyping: boolean) => {
      const user = presenceMap[documentId]?.[socket.id];
      if (user) {
        socket.to(documentId).emit('user-typing', { ...user, isTyping });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔴 User disconnected: ${socket.id} (reason: ${reason})`);
      if (currentDocId && presenceMap[currentDocId]) {
        delete presenceMap[currentDocId][socket.id];
        broadcastPresence(io, currentDocId);
      }
    });
  });
};
