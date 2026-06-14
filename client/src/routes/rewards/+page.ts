import type { PageLoad } from './$types';
import { buildRewardsExamples, fetchRewardsCatalog } from '$lib/rewards';

export const load: PageLoad = async ({ fetch }) => {
  try {
    const rewards = await fetchRewardsCatalog(fetch);
    return {
      rewards,
      examples: buildRewardsExamples(rewards),
    };
  } catch (error) {
    console.error('Failed to load rewards catalog', error);
    return {
      rewards: [],
      examples: [],
    };
  }
};