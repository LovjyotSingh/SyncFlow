import assert from 'node:assert/strict';
import test from 'node:test';
import { shareTokenFromInput } from './shareLink.ts';

const token = '3f1c2a90-7b14-4d2e-8a11-0c6e5b7a9d42';

test('reads a token from a full share link', () => {
  assert.equal(shareTokenFromInput(`https://syncflow.app/doc/${token}`), token);
  assert.equal(shareTokenFromInput(`https://syncflow.app/doc/${token}/`), token);
  assert.equal(shareTokenFromInput(`http://localhost:3000/doc/${token}?doc=other`), token);
});

test('reads a pasted path or bare token', () => {
  assert.equal(shareTokenFromInput(`/doc/${token}`), token);
  assert.equal(shareTokenFromInput(`doc/${token}`), token);
  assert.equal(shareTokenFromInput(token), token);
});

test('rejects anything that is not a share link', () => {
  assert.equal(shareTokenFromInput(''), null);
  assert.equal(shareTokenFromInput('https://example.com/pages/1'), null);
  assert.equal(shareTokenFromInput('not a link'), null);
});
