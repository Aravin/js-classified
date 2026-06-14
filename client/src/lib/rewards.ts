import { browser } from '$app/environment';
import { config } from '$lib/config';
import { createBrowserScopedCache } from './browser-scoped-cache';
import type { RewardAction } from './types/rewards';

export interface RewardCatalogItem {
  action: RewardAction;
  points: number;
  title: string;
  description: string;
}

export interface RewardSummary {
  points: number;
  breakdown: Array<{
    action: RewardAction;
    title: string;
    count: number;
    points: number;
  }>;
  recentRewards: Array<{
    id: number;
    action: RewardAction;
    points: number;
    createdAt: string;
    sourceType: string | null;
    sourceId: number | null;
    metadata: unknown;
  }>;
  ranks: {
    allTime: number | null;
    monthly: number | null;
  };
}

const rewardSummaryCache = createBrowserScopedCache<RewardSummary>(browser);

export function getCachedRewardSummary(): RewardSummary | null {
  return rewardSummaryCache.get();
}

export async function fetchRewardSummary(
  fetcher: typeof fetch,
  headers: Record<string, string>,
): Promise<RewardSummary> {
  const response = await fetcher(`${config.api.baseUrl}/rewards/me`, {
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch reward summary');
  }

  const summary = (await response.json()) as RewardSummary;
  rewardSummaryCache.set(summary);
  return summary;
}

export async function refreshRewardSummary(
  fetcher: typeof fetch,
  headers: Record<string, string>,
): Promise<RewardSummary | null> {
  if (!headers.Authorization) {
    rewardSummaryCache.set(null);
    return null;
  }

  try {
    return await fetchRewardSummary(fetcher, headers);
  } catch {
    return rewardSummaryCache.get();
  }
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string | null;
  fullName: string | null;
  avatar: string | null;
  points: number;
}

export interface RewardsExample {
  title: string;
  steps: string[];
  totalPoints: number;
}

export function calculateExampleTotal(actions: Array<{ points: number; count: number }>): number {
  return actions.reduce((sum, action) => sum + action.points * action.count, 0);
}

export function buildRewardsExamples(rewards: RewardCatalogItem[]): RewardsExample[] {
  const byAction = new Map(rewards.map((reward) => [reward.action, reward]));
  const dailyLogin = byAction.get('DAILY_LOGIN');
  const listingPublished = byAction.get('LISTING_PUBLISHED');
  const listingRepublished = byAction.get('LISTING_REPUBLISHED');
  const profileCompleted = byAction.get('PROFILE_COMPLETED');

  return [
    {
      title: 'Weekly activity starter',
      steps: [
        'Log in every day for 7 days',
        'Publish your first 2 listings',
      ],
      totalPoints: calculateExampleTotal([
        { points: dailyLogin?.points ?? 0, count: 7 },
        { points: listingPublished?.points ?? 0, count: 2 },
      ]),
    },
    {
      title: 'Refresh an expired ad',
      steps: [
        'Log in on the day you return',
        'Republish 1 expired listing',
      ],
      totalPoints: calculateExampleTotal([
        { points: dailyLogin?.points ?? 0, count: 1 },
        { points: listingRepublished?.points ?? 0, count: 1 },
      ]),
    },
    {
      title: 'Complete your profile and go live',
      steps: [
        'Add your email, phone, full name, and avatar',
        'Publish 1 listing',
      ],
      totalPoints: calculateExampleTotal([
        { points: profileCompleted?.points ?? 0, count: 1 },
        { points: listingPublished?.points ?? 0, count: 1 },
      ]),
    },
  ];
}

export async function fetchRewardsCatalog(fetcher: typeof fetch): Promise<RewardCatalogItem[]> {
  const response = await fetcher(`${config.api.baseUrl}/rewards/catalog`);
  if (!response.ok) {
    throw new Error('Failed to fetch rewards catalog');
  }

  const result = await response.json();
  return result.rewards ?? [];
}

export async function fetchLeaderboard(
  fetcher: typeof fetch,
  period: 'all' | 'month' = 'all',
  limit = 20,
): Promise<LeaderboardEntry[]> {
  const searchParams = new URLSearchParams({
    period,
    limit: limit.toString(),
  });
  const response = await fetcher(`${config.api.baseUrl}/rewards/leaderboard?${searchParams}`);

  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }

  const result = await response.json();
  return result.leaderboard ?? [];
}