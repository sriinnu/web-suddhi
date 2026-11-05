// Guards against the content script's self-scheduling loop.
// applyBlocking() used to call handleDynamicContent(), which scheduled three
// more applyBlocking() calls, each of which did the same — an exponential
// timer tree that pinned a CPU core on every page.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(ROOT_DIR, 'content/ad-blocker.js'), 'utf8');

function functionBody(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found`);

  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return source.slice(start);
}

describe('content script scheduling', () => {
  it('does not schedule applyBlocking from inside applyBlocking', () => {
    const body = functionBody('applyBlocking');

    expect(body).not.toContain('handleDynamicContent');
    expect(body).not.toMatch(/setTimeout\(\s*\(\)\s*=>\s*applyBlocking/);
  });

  it('keeps a single, guarded late pass', () => {
    const body = functionBody('scheduleLateSweep');

    expect(body).toMatch(/if \(dynamicContentTimer\) return;/);
    expect(body.match(/setTimeout\(/g)).toHaveLength(1);
  });
});
