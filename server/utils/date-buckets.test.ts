import { describe, expect, it } from 'vitest';
import { startOfUtcDay } from './date-buckets';

describe('startOfUtcDay', () => {
  it('normalizes a timestamp to midnight UTC on the same UTC calendar day', () => {
    expect(startOfUtcDay(new Date('2026-06-14T18:45:33.123Z')).toISOString()).toBe(
      '2026-06-14T00:00:00.000Z',
    );
  });

  it('uses the UTC date boundary instead of the local timezone boundary', () => {
    expect(startOfUtcDay(new Date('2026-06-14T00:30:00+05:30')).toISOString()).toBe(
      '2026-06-13T00:00:00.000Z',
    );
  });
});