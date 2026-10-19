import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  const period = url.searchParams.get('period') === 'month' ? 'month' : 'all';
  throw redirect(308, `/rewards?period=${period}#leaderboard`);
};
