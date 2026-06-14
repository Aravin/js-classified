import type { PageLoad } from './$types';
import { fetchLeaderboard } from '$lib/rewards';

export const load: PageLoad = async ({ url, fetch }) => {
  const period = url.searchParams.get('period') === 'month' ? 'month' : 'all';

  try {
    const leaderboard = await fetchLeaderboard(fetch, period, 20);
    return {
      leaderboard,
      period,
    };
  } catch (error) {
    console.error('Failed to load leaderboard', error);
    return {
      leaderboard: [],
      period,
    };
  }
};