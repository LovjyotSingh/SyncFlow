import { Server, Socket } from 'socket.io';
import { RedisClientType } from 'redis';

export interface PresenceUser {
  socketId: string;
  userId?: string;
  name: string;
  color: string;
  isTyping?: boolean;
}

// Track presence: { documentId: { socketId: PresenceUser } }
const presenceMap: Record<string, Record<string, PresenceUser>> = {};

let globalIo: Server | null = null;

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

export const kickUserFromDocument = (documentId: string, targetUserId: string) => {
  if (!globalIo || !presenceMap[documentId]) return;
  const socketsToKick: string[] = [];
  for (const [sockId, user] of Object.entries(presenceMap[documentId])) {
    if (user.userId === targetUserId) {
      socketsToKick.push(sockId);
    }
  }
  for (const sId of socketsToKick) {
    globalIo.to(sId).emit('kicked', {
      documentId,
      message: 'You have been removed from this workspace by the owner.',
    });
    delete presenceMap[documentId][sId];
    const targetSock = globalIo.sockets.sockets.get(sId);
    if (targetSock) targetSock.leave(documentId);
  }
  broadcastPresence(globalIo, documentId);
};

export const kickAllFromDocument = (documentId: string, ownerUserId: string) => {
  if (!globalIo || !presenceMap[documentId]) return;
  const socketsToKick: string[] = [];
  for (const [sockId, user] of Object.entries(presenceMap[documentId])) {
    if (user.userId !== ownerUserId) {
      socketsToKick.push(sockId);
    }
  }
  for (const sId of socketsToKick) {
    globalIo.to(sId).emit('kicked', {
      documentId,
      message: 'The workspace owner has ended collaboration and made this document private.',
    });
    delete presenceMap[documentId][sId];
    const targetSock = globalIo.sockets.sockets.get(sId);
    if (targetSock) targetSock.leave(documentId);
  }
  broadcastPresence(globalIo, documentId);
};

export const setupSocket = (io: Server, redisClient: any) => {
  globalIo = io;

  io.on('connection', (socket: Socket) => {
    console.log(`🟢 User connected: ${socket.id}`);

    let currentDocId: string | null = null;

    // Join a specific document room
    socket.on('join-document', async (documentId: string, userData?: any) => {
      socket.join(documentId);
      currentDocId = documentId;

      let name = `Guest ${socket.id.slice(0, 4)}`;
      let userId: string | undefined = undefined;
      let color = getRandomColor();

      if (typeof userData === 'object' && userData !== null) {
        name = userData.name || name;
        userId = userData.userId;
        color = userData.color || color;
      } else if (typeof userData === 'string' && userData.trim()) {
        name = userData.trim();
      }

      console.log(`User ${socket.id} (${name}, uid: ${userId}) joined document ${documentId}`);

      // Register presence
      if (!presenceMap[documentId]) presenceMap[documentId] = {};
      presenceMap[documentId][socket.id] = {
        socketId: socket.id,
        userId,
        name,
        color,
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

    // Handle kick-user event from client
    socket.on('kick-user', ({ documentId, targetSocketId, targetUserId, targetName }: {
      documentId: string;
      targetSocketId?: string;
      targetUserId?: string;
      targetName?: string;
    }) => {
      if (!presenceMap[documentId]) return;

      console.log(`👢 Kick event received for ${targetName || targetUserId || targetSocketId} in doc ${documentId}`);

      const socketsToKick: string[] = [];
      for (const [sockId, user] of Object.entries(presenceMap[documentId])) {
        if (
          (targetSocketId && sockId === targetSocketId) ||
          (targetUserId && user.userId === targetUserId) ||
          (targetName && user.name.toLowerCase() === targetName.toLowerCase())
        ) {
          socketsToKick.push(sockId);
        }
      }

      for (const sId of socketsToKick) {
        io.to(sId).emit('kicked', {
          documentId,
          message: 'You have been kicked from this workspace by the owner.',
        });
        delete presenceMap[documentId][sId];
        const targetSock = io.sockets.sockets.get(sId);
        if (targetSock) targetSock.leave(documentId);
      }

      broadcastPresence(io, documentId);
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
