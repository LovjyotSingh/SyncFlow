import * as Y from 'yjs';

export const MAX_FILE_BYTES = 32 * 1024 * 1024;
const CHUNK_CHARS = 400_000;

export interface PageFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  complete: boolean;
  chunks: number;
}

function metaMap(ydoc: Y.Doc) {
  return ydoc.getMap<Y.Map<unknown>>('shared-files');
}

function chunkMap(ydoc: Y.Doc) {
  return ydoc.getMap<string>('shared-file-chunks');
}

export function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

export function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function looksLikeText(bytes: Uint8Array) {
  const sample = bytes.subarray(0, 8192);
  if (sample.includes(0)) return false;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(sample);
    if (!text) return bytes.length === 0;
    let printable = 0;
    for (const char of text) {
      const code = char.codePointAt(0) || 0;
      if (char === '\n' || char === '\r' || char === '\t' || (code >= 32 && code !== 127)) printable += 1;
    }
    return printable / text.length > 0.9;
  } catch {
    return false;
  }
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function listPageFiles(ydoc: Y.Doc) {
  const json = metaMap(ydoc).toJSON() as Record<string, Omit<PageFile, 'id'>>;
  return Object.entries(json)
    .map(([id, file]) => ({ ...file, id }))
    .filter((file) => file.complete)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function readPageFile(ydoc: Y.Doc, id: string) {
  const info = (metaMap(ydoc).toJSON() as Record<string, PageFile>)[id];
  if (!info?.complete) return null;
  const chunks = chunkMap(ydoc);
  let encoded = '';
  for (let index = 0; index < info.chunks; index += 1) {
    const part = chunks.get(`${id}:${index}`);
    if (typeof part !== 'string') return null;
    encoded += part;
  }
  return decodeBase64(encoded);
}

export async function writePageFile(
  ydoc: Y.Doc,
  file: { name: string; mime: string; bytes: Uint8Array; uploadedBy: string; uploadedByName: string },
) {
  if (file.bytes.byteLength < 1) throw new Error('Choose a file to share');
  if (file.bytes.byteLength > MAX_FILE_BYTES) throw new Error('Files must be 32 MB or smaller');

  const id = crypto.randomUUID();
  const encoded = encodeBase64(file.bytes);
  const parts: string[] = [];
  for (let index = 0; index < encoded.length; index += CHUNK_CHARS) {
    parts.push(encoded.slice(index, index + CHUNK_CHARS));
  }

  const record = {
    name: file.name,
    mime: file.mime || 'application/octet-stream',
    size: file.bytes.byteLength,
    uploadedBy: file.uploadedBy,
    uploadedByName: file.uploadedByName,
    createdAt: new Date().toISOString(),
    complete: false,
    chunks: parts.length,
  };
  metaMap(ydoc).set(id, new Y.Map(Object.entries(record)));

  const chunks = chunkMap(ydoc);
  for (let index = 0; index < parts.length; index += 1) {
    await tick();
    chunks.set(`${id}:${index}`, parts[index]);
  }
  await tick();
  metaMap(ydoc).get(id)?.set('complete', true);
  return id;
}

export function deletePageFile(ydoc: Y.Doc, id: string) {
  const info = (metaMap(ydoc).toJSON() as Record<string, PageFile>)[id];
  ydoc.transact(() => {
    metaMap(ydoc).delete(id);
    const chunks = chunkMap(ydoc);
    for (let index = 0; index < (info?.chunks || 0); index += 1) chunks.delete(`${id}:${index}`);
  });
}
