import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import * as Y from 'yjs';
import type { RedisClientType } from 'redis';
import mongoose from 'mongoose';
import { Document } from '../models/Document';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'syncflow-dev-secret';

export interface PresenceUser {
  socketId: string;
  userId: string;
  name: string;
  color: string;
}

type AuthedSocket = Socket & {
  data: {
    userId?: string;
    documentId?: string;
    clientId?: number;
  };
};

const presence = new Map<string, Map<string, PresenceUser>>();
const docs = new Map<string, Y.Doc>();
const loading = new Map<string, Promise<Y.Doc>>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function roomPresence(documentId: string) {
  let room = presence.get(documentId);
  if (!room) {
    room = new Map();
    presence.set(documentId, room);
  }
  return room;
}

function broadcastPresence(io: Server, documentId: string) {
  io.to(documentId).emit('presence', [...roomPresence(documentId).values()]);
}

async function loadDoc(id: string, redis: RedisClientType | null) {
  const existing = docs.get(id);
  if (existing) return existing;
  const pending = loading.get(id);
  if (pending) return pending;

  const task = (async () => {
    const doc = new Y.Doc();
    if (redis?.isReady) {
      const saved = await redis.get(`ydoc:${id}`);
      if (typeof saved === 'string' && saved.length > 0) {
        Y.applyUpdate(doc, Buffer.from(saved, 'base64'));
      }
    }
    docs.set(id, doc);
    return doc;
  })();

  loading.set(id, task);
  try {
    return await task;
  } finally {
    loading.delete(id);
  }
}

function scheduleSave(id: string, doc: Y.Doc, redis: RedisClientType | null) {
  const previous = saveTimers.get(id);
  if (previous) clearTimeout(previous);
  saveTimers.set(id, setTimeout(() => {
    saveTimers.delete(id);
    const encoded = Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
    if (redis?.isReady) {
      redis.set(`ydoc:${id}`, encoded, { EX: 60 * 60 * 24 * 30 }).catch((err) => {
        console.error('redis save failed', err);
      });
    }
    if (mongoose.isValidObjectId(id)) {
      Document.updateOne({ _id: id }, { $set: { updatedAt: new Date() } }).catch(() => undefined);
    }
  }, 700));
}

async function authorize(token: string, documentId: string) {
  if (!token || !mongoose.isValidObjectId(documentId)) return null;
  let userId = '';
  try {
    userId = (jwt.verify(token, JWT_SECRET) as { userId: string }).userId;
  } catch {
    return null;
  }
  const [user, document] = await Promise.all([
    User.findById(userId).select('name avatarColor'),
    Document.findOne({
      _id: documentId,
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select('_id'),
  ]);
  if (!user || !document) return null;
  return user;
}

export function setupSocket(io: Server, redis: RedisClientType | null) {
  io.on('connection', (socket: AuthedSocket) => {
    socket.on('join-document', async (payload: { documentId?: string; token?: string; clientId?: number }) => {
      const documentId = String(payload?.documentId || '');
      const user = await authorize(String(payload?.token || ''), documentId);
      if (!user) {
        socket.emit('forbidden', 'You do not have access to this page');
        return;
      }

      if (socket.data.documentId && socket.data.documentId !== documentId) {
        socket.leave(socket.data.documentId);
        roomPresence(socket.data.documentId).delete(socket.id);
        broadcastPresence(io, socket.data.documentId);
      }

      socket.data.userId = String(user._id);
      socket.data.documentId = documentId;
      socket.data.clientId = Number(payload?.clientId) || undefined;
      socket.join(documentId);
      roomPresence(documentId).set(socket.id, {
        socketId: socket.id,
        userId: String(user._id),
        name: user.name,
        color: user.avatarColor,
      });
      broadcastPresence(io, documentId);

      const doc = await loadDoc(documentId, redis);
      socket.emit('y-sync', Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64'));
    });

    socket.on('y-update', async (payload: { documentId?: string; update?: string }) => {
      const documentId = String(payload?.documentId || '');
      const update = String(payload?.update || '');
      if (!update || socket.data.documentId !== documentId) return;
      try {
        const doc = await loadDoc(documentId, redis);
        Y.applyUpdate(doc, Buffer.from(update, 'base64'));
        socket.to(documentId).emit('y-update', update);
        scheduleSave(documentId, doc, redis);
      } catch (error) {
        console.error('y-update failed', error);
      }
    });

    socket.on('awareness', (payload: { documentId?: string; update?: string }) => {
      const documentId = String(payload?.documentId || '');
      const update = String(payload?.update || '');
      if (!update || socket.data.documentId !== documentId) return;
      socket.to(documentId).emit('awareness', update);
    });

    socket.on('disconnect', () => {
      const documentId = socket.data.documentId;
      if (!documentId) return;
      roomPresence(documentId).delete(socket.id);
      broadcastPresence(io, documentId);
      if (socket.data.clientId) {
        socket.to(documentId).emit('peer-left', socket.data.clientId);
      }
    });
  });
}
