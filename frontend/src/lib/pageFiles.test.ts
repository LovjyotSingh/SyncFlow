import assert from 'node:assert/strict';
import test from 'node:test';
import * as Y from 'yjs';
import { deletePageFile, listPageFiles, looksLikeText, readPageFile, writePageFile } from './pageFiles.ts';

test('a text file and a large code file survive a synced document', async () => {
  const source = new Y.Doc();
  const copy = new Y.Doc();
  const sizes: number[] = [];
  source.on('update', (update) => {
    sizes.push(update.byteLength);
    Y.applyUpdate(copy, update);
  });

  const text = new TextEncoder().encode('hello from a text file\nconst value = 1;\n');
  await writePageFile(source, {
    name: 'notes.txt',
    mime: 'text/plain',
    bytes: text,
    uploadedBy: 'user-1',
    uploadedByName: 'Asha',
  });

  const code = new Uint8Array(900_000);
  const line = new TextEncoder().encode('export const line = "syncflow";\n');
  for (let index = 0; index < code.length; index += 1) code[index] = line[index % line.length];
  await writePageFile(source, {
    name: 'service.ts',
    mime: '',
    bytes: code,
    uploadedBy: 'user-1',
    uploadedByName: 'Asha',
  });

  assert.ok(Math.max(...sizes) < 1_000_000);
  const files = listPageFiles(copy);
  assert.deepEqual(files.map((file) => file.name).sort(), ['notes.txt', 'service.ts']);
  assert.deepEqual(readPageFile(copy, files.find((file) => file.name === 'notes.txt')!.id), text);
  assert.deepEqual(readPageFile(copy, files.find((file) => file.name === 'service.ts')!.id), code);
  assert.equal(looksLikeText(code), true);
  assert.equal(looksLikeText(Uint8Array.from([0, 1, 2, 3, 255])), false);

  deletePageFile(copy, files[0].id);
  assert.equal(listPageFiles(copy).length, 1);
});
