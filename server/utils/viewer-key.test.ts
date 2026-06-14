import { describe, expect, it } from 'vitest';
import { anonymizeViewerKey } from './viewer-key';

describe('anonymizeViewerKey', () => {
  it('hashes the raw identifier so it is not stored directly', () => {
    const viewerKey = anonymizeViewerKey('user', 'auth0|buyer', 'test-secret');

    expect(viewerKey).toMatch(/^user:[a-f0-9]{64}$/);
    expect(viewerKey).not.toContain('auth0|buyer');
  });

  it('is stable for the same input and changes when the secret changes', () => {
    const first = anonymizeViewerKey('ip', '127.0.0.1', 'secret-one');
    const second = anonymizeViewerKey('ip', '127.0.0.1', 'secret-one');
    const third = anonymizeViewerKey('ip', '127.0.0.1', 'secret-two');

    expect(first).toBe(second);
    expect(first).not.toBe(third);
  });
});