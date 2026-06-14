import { describe, expect, it } from 'vitest';
import { buildErrorResponseBody } from './http-errors';

describe('buildErrorResponseBody', () => {
  it('returns both error and message fields for backward-compatible API errors', () => {
    expect(buildErrorResponseBody('User not found')).toEqual({
      error: 'User not found',
      message: 'User not found',
    });
  });

  it('preserves optional details alongside both error fields', () => {
    expect(buildErrorResponseBody('Invalid token audience', 'Token audience mismatch')).toEqual({
      error: 'Invalid token audience',
      message: 'Invalid token audience',
      details: 'Token audience mismatch',
    });
  });
});