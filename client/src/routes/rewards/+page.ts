import type { PageLoad } from './$types';
import { buildRewardsExamples, fetchLeaderboard, fetchRewardsCatalog } from '$lib/rewards';

export const load: PageLoad = async ({ url, fetch }) => {
  const period = url.searchParams.get('period') === 'month' ? 'month' : 'all';

  const [rewards, leaderboard] = await Promise.all([
    fetchRewardsCatalog(fetch).catch((error) => {
      console.error('Failed to load rewards catalog', error);
      return [];
    }),
    fetchLeaderboard(fetch, period, 20).catch((error) => {
      console.error('Failed to load leaderboard', error);
      return [];
    }),
  ]);

  return {
    rewards,
    examples: buildRewardsExamples(rewards),
    leaderboard,
    period,
  };
};
