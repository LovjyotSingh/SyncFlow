import { ApiError, BACKEND_URL, api, getToken } from './auth';

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

export interface SharedFileRecord {
  _id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
  uploadedBy: {
    _id: string;
    name: string;
  };
}

export function listSharedFiles(documentId: string) {
  return api<SharedFileRecord[]>(`/api/documents/${documentId}/files`);
}

export function deleteSharedFile(documentId: string, fileId: string) {
  return api<{ id: string }>(`/api/documents/${documentId}/files/${fileId}`, { method: 'DELETE' });
}

export async function uploadSharedFile(documentId: string, file: File) {
  const token = getToken();
  const body = new FormData();
  body.append('file', file);
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/documents/${documentId}/files`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
  } catch {
    throw new ApiError('Cannot reach SyncFlow. Check that the API is running.', 0);
  }
  const data = await response.json().catch(() => ({} as { message?: string }));
  if (!response.ok) throw new ApiError(data.message || 'Could not share that file', response.status);
  return data as SharedFileRecord;
}

export async function fetchSharedFile(documentId: string, file: SharedFileRecord) {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/documents/${documentId}/files/${file._id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError('Cannot reach SyncFlow. Check that the API is running.', 0);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({} as { message?: string }));
    throw new ApiError(data.message || 'Could not open that file', response.status);
  }

  const raw = await response.blob();
  const mime = (file.mime || raw.type || 'application/octet-stream').split(';')[0].trim();
  if (!mime || raw.type === mime) return raw;
  return new Blob([raw], { type: mime });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
