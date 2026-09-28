import { api } from './auth';

export interface Person {
  _id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export interface SyncDocument {
  _id: string;
  title: string;
  shareToken: string;
  owner: string | Person;
  collaborators: Array<string | Person>;
  invitedEmails: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PeopleResponse {
  owner: Person;
  collaborators: Person[];
  invitedEmails: string[];
  shareToken: string;
}

export function ownerId(document: SyncDocument) {
  return typeof document.owner === 'string' ? document.owner : document.owner._id;
}

export function listDocuments() {
  return api<SyncDocument[]>('/api/documents/user/me');
}

export function createDocument(title: string) {
  return api<SyncDocument>('/api/documents', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function renameDocument(id: string, title: string) {
  return api<SyncDocument>(`/api/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
}

export function deleteDocument(id: string) {
  return api<{ id: string }>(`/api/documents/${id}`, { method: 'DELETE' });
}

export function joinShare(token: string) {
  return api<SyncDocument>(`/api/documents/share/${token}`);
}

export function getPeople(id: string) {
  return api<PeopleResponse>(`/api/documents/${id}/collaborators`);
}

export function invitePerson(id: string, email: string) {
  return api<PeopleResponse & { message: string }>(`/api/documents/${id}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function leaveDocument(id: string) {
  return api<{ id: string }>(`/api/documents/${id}/leave`, { method: 'POST' });
}

export function revokeShareLink(id: string) {
  return api<{ shareToken: string }>(`/api/documents/${id}/revoke-link`, { method: 'POST' });
}

export function formatWhen(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'S';
}
