import { describe, expect, it, vi } from 'vitest';

import { load } from './+page';

type RewardsPageData = {
  period: string;
  rewards: unknown[];
  examples: unknown[];
  leaderboard: Array<{ rank: number; points: number }>;
};

function runLoad(fetch: typeof globalThis.fetch, url: string) {
  return load({ url: new URL(url), fetch } as never) as Promise<RewardsPageData>;
}

function createFetchMock(overrides: { leaderboardOk?: boolean; rewardsOk?: boolean } = {}) {
  const { leaderboardOk = true, rewardsOk = true } = overrides;

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.includes('/rewards/catalog')) {
      return {
        ok: rewardsOk,
        json: async () => ({
          rewards: [
            {
              action: 'DAILY_LOGIN',
              points: 5,
              title: 'Daily login',
              description: 'Earn points once per day.',
            },
          ],
        }),
      };
    }

    if (url.includes('/rewards/leaderboard')) {
      return {
        ok: leaderboardOk,
        json: async () => ({ leaderboard: [{ rank: 1, points: 10 }] }),
      };
    }

    throw new Error(`Unexpected fetch request: ${url}`);
  });
}

describe('rewards page load', () => {
  it('loads the catalog, worked examples, and leaderboard for the requested period', async () => {
    const fetchMock = createFetchMock();

    const result = await runLoad(fetchMock as never, 'http://localhost/rewards?period=month');

    expect(result.period).toBe('month');
    expect(result.rewards).toHaveLength(1);
    expect(result.examples).toHaveLength(3);
    expect(result.leaderboard).toEqual([{ rank: 1, points: 10 }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('period=month'));
  });

  it('defaults to the all-time period when no period is supplied', async () => {
    const fetchMock = createFetchMock();

    const result = await runLoad(fetchMock as never, 'http://localhost/rewards');

    expect(result.period).toBe('all');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('period=all'));
  });

  it('still renders rewards and examples when the leaderboard request fails', async () => {
    const fetchMock = createFetchMock({ leaderboardOk: false });

    const result = await runLoad(fetchMock as never, 'http://localhost/rewards');

    expect(result.rewards).toHaveLength(1);
    expect(result.examples).toHaveLength(3);
    expect(result.leaderboard).toEqual([]);
  });
});
