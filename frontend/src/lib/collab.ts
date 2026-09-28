import { io, type Socket } from 'socket.io-client';
import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { BACKEND_URL, getToken } from './auth';

export interface PresenceUser {
  socketId: string;
  userId: string;
  name: string;
  color: string;
}

interface ConnectOptions {
  documentId: string;
  ydoc: Y.Doc;
  awareness: Awareness;
  onReady: () => void;
  onStatus: (status: 'connecting' | 'live' | 'offline') => void;
  onPresence: (users: PresenceUser[]) => void;
  onForbidden: (message: string) => void;
}

function toBase64(update: Uint8Array) {
  let binary = '';
  const size = 0x8000;
  for (let index = 0; index < update.length; index += size) {
    binary += String.fromCharCode(...update.subarray(index, index + size));
  }
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function connectDocument({
  documentId,
  ydoc,
  awareness,
  onReady,
  onStatus,
  onPresence,
  onForbidden,
}: ConnectOptions) {
  let ready = false;
  const socket: Socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 12,
    timeout: 10000,
  });

  const sendLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (!ready || origin === 'remote') return;
    socket.emit('y-update', { documentId, update: toBase64(update) });
  };

  const sendAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === 'remote') return;
    const changed = added.concat(updated, removed);
    if (changed.length === 0) return;
    socket.emit('awareness', { documentId, update: toBase64(encodeAwarenessUpdate(awareness, changed)) });
  };

  ydoc.on('update', sendLocalUpdate);
  awareness.on('update', sendAwareness);

  const join = () => {
    onStatus(ready ? 'live' : 'connecting');
    socket.emit('join-document', {
      documentId,
      token: getToken(),
      clientId: ydoc.clientID,
    });
  };

  socket.on('connect', join);
  socket.on('disconnect', () => onStatus('offline'));
  socket.on('connect_error', () => onStatus('offline'));
  socket.on('forbidden', (message: string) => onForbidden(message || 'You do not have access to this page'));
  socket.on('presence', (users: PresenceUser[]) => onPresence(users));
  socket.on('y-sync', (update: string) => {
    if (update) Y.applyUpdate(ydoc, fromBase64(update), 'remote');
    ready = true;
    onReady();
    onStatus('live');
  });
  socket.on('y-update', (update: string) => {
    if (!update) return;
    Y.applyUpdate(ydoc, fromBase64(update), 'remote');
  });
  socket.on('awareness', (update: string) => {
    if (!update) return;
    applyAwarenessUpdate(awareness, fromBase64(update), 'remote');
  });
  socket.on('peer-left', (clientId: number) => {
    removeAwarenessStates(awareness, [clientId], 'remote');
  });

  return () => {
    ready = false;
    ydoc.off('update', sendLocalUpdate);
    awareness.off('update', sendAwareness);
    awareness.setLocalState(null);
    socket.disconnect();
  };
}
