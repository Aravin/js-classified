import { describe, expect, it } from 'vitest';

import { load } from './+page';

async function runLoad(search: string) {
  try {
    await load({ url: new URL(`http://localhost/leaderboard${search}`) } as never);
  } catch (error) {
    return error as { status: number; location: string };
  }
  throw new Error('Expected the leaderboard load to throw a redirect');
}

describe('leaderboard redirect', () => {
  it('permanently redirects to the merged rewards page with the monthly period', async () => {
    const error = await runLoad('?period=month');
    expect(error).toMatchObject({
      status: 308,
      location: '/rewards?period=month#leaderboard',
    });
  });

  it('defaults to the all-time period', async () => {
    const error = await runLoad('');
    expect(error).toMatchObject({
      status: 308,
      location: '/rewards?period=all#leaderboard',
    });
  });
});
