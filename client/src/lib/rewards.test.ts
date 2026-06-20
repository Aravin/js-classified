import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
  browser: true,
}));

import {
  buildRewardsExamples,
  calculateExampleTotal,
  fetchRewardSummary,
  fetchLeaderboard,
  fetchRewardsCatalog,
  getCachedRewardSummary,
  refreshRewardSummary,
} from './rewards';

describe('calculateExampleTotal', () => {
  it('sums repeated reward actions into a single total', () => {
    expect(
      calculateExampleTotal([
        { points: 5, count: 7 },
        { points: 10, count: 2 },
        { points: 4, count: 1 },
      ]),
    ).toBe(59);
  });
});

describe('buildRewardsExamples', () => {
  it('builds worked examples from the reward catalog values', () => {
    const examples = buildRewardsExamples([
      {
        action: 'DAILY_LOGIN',
        points: 5,
        title: 'Daily login',
        description: 'Earn points once per day.',
      },
      {
        action: 'LISTING_PUBLISHED',
        points: 10,
        title: 'Publish',
        description: 'Earn points for publishing.',
      },
      {
        action: 'LISTING_REPUBLISHED',
        points: 4,
        title: 'Republish',
        description: 'Earn points for republishing.',
      },
      {
        action: 'PROFILE_COMPLETED',
        points: 15,
        title: 'Profile',
        description: 'Earn points for completing your profile.',
      },
    ]);

    expect(examples).toHaveLength(3);
    expect(examples[0]).toEqual(
      expect.objectContaining({
        title: 'Weekly activity starter',
        totalPoints: 55,
      }),
    );
    expect(examples[1].totalPoints).toBe(9);
    expect(examples[2].totalPoints).toBe(25);
  });

  it('falls back to zero values when an action is missing from the catalog', () => {
    const examples = buildRewardsExamples([]);
    expect(examples.every((example) => example.totalPoints === 0)).toBe(true);
  });
});

describe('rewards API helpers', () => {
  it('fetches the public rewards catalog', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rewards: [{ action: 'DAILY_LOGIN', points: 5 }] }),
    });

    const rewards = await fetchRewardsCatalog(mockFetch as never);

    expect(rewards).toEqual([{ action: 'DAILY_LOGIN', points: 5 }]);
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/rewards/catalog'));
  });

  it('requests leaderboard data for the selected period', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leaderboard: [{ rank: 1, points: 10 }] }),
    });

    const leaderboard = await fetchLeaderboard(mockFetch as never, 'month', 12);

    expect(leaderboard).toEqual([{ rank: 1, points: 10 }]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/rewards/leaderboard?period=month&limit=12'),
    );
  });

  it('fetches and caches the authenticated reward summary', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ points: 22, recentRewards: [], ranks: { allTime: 2, monthly: 1 } }),
    });

    const summary = await fetchRewardSummary(mockFetch as never, { Authorization: 'Bearer token' });

    expect(summary.points).toBe(22);
    expect(getCachedRewardSummary()?.points).toBe(22);
  });

  it('refreshes the reward summary only when authorization exists', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ points: 8, recentRewards: [], ranks: { allTime: null, monthly: null } }),
    });

    const unauthorized = await refreshRewardSummary(mockFetch as never, {});
    expect(unauthorized).toBeNull();

    const authorized = await refreshRewardSummary(mockFetch as never, {
      Authorization: 'Bearer token',
    });
    expect(authorized?.points).toBe(8);
  });
});
