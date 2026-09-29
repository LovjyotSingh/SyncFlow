import assert from 'node:assert/strict';
import test from 'node:test';
import { filePreviewKind } from './sharedFile.ts';

test('opens pdf and text in the page', () => {
  assert.equal(filePreviewKind({ name: 'notes.pdf', mime: 'application/pdf' }), 'pdf');
  assert.equal(filePreviewKind({ name: 'notes.PDF', mime: 'application/octet-stream' }), 'pdf');
  assert.equal(filePreviewKind({ name: 'notes.txt', mime: 'text/plain' }), 'text');
  assert.equal(filePreviewKind({ name: 'notes.txt', mime: 'text/plain; charset=utf-8' }), 'text');
  assert.equal(filePreviewKind({ name: 'notes.txt', mime: '' }), 'text');
  assert.equal(filePreviewKind({ name: 'readme.md', mime: 'application/octet-stream' }), 'text');
});

test('downloads types the page cannot render', () => {
  assert.equal(filePreviewKind({ name: 'archive.zip', mime: 'application/zip' }), 'download');
});
