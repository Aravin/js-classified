import fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REWARD_CATALOG } from '../../services/reward.service';
import { normalizeLeaderboardQueryParams, rewardRoutes } from './reward.routes';

const testContext = vi.hoisted(() => ({
  tokenUsers: new Map<string, { sub: string }>(),
  rewardServiceMock: {
    getUserSummary: vi.fn(),
    getLeaderboard: vi.fn(),
  },
}));

vi.mock('../../middleware/auth', () => ({
  verifyAuth0Token: vi.fn(async (request: { headers: { authorization?: string }; user?: { sub: string } }, reply: { code: (statusCode: number) => { send: (body: unknown) => void } }) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Missing Authorization header' });
      return false;
    }

    const token = authHeader.slice(7);
    const user = testContext.tokenUsers.get(token);
    if (!user) {
      reply.code(401).send({ error: 'Invalid token' });
      return false;
    }

    request.user = user;
    return true;
  }),
}));

vi.mock('../../services/reward.service', async () => {
  const actual = await vi.importActual<typeof import('../../services/reward.service')>(
    '../../services/reward.service',
  );

  return {
    ...actual,
    RewardService: class RewardService {
      constructor() {
        return testContext.rewardServiceMock;
      }
    },
  };
});

function createApp(userRecord: { id: number } | null = { id: 7 }) {
  const app = fastify();
  app.decorate('prisma', {
    user: {
      findUnique: vi.fn(async () => userRecord),
    },
  } as never);

  return app.register(rewardRoutes, { prefix: '/rewards' }).then(async () => {
    await app.ready();
    return app;
  });
}

const openApps: FastifyInstance[] = [];

beforeEach(() => {
  testContext.tokenUsers.clear();
  testContext.tokenUsers.set('valid-token', { sub: 'auth0|user' });
  testContext.rewardServiceMock.getUserSummary.mockReset();
  testContext.rewardServiceMock.getLeaderboard.mockReset();
});

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe('rewardRoutes /catalog', () => {
  it('returns the public reward catalog with the expected response shape', async () => {
    const app = await createApp();
    openApps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/rewards/catalog',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      rewards: REWARD_CATALOG,
    });
  });
});

describe('normalizeLeaderboardQueryParams', () => {
  it('coerces string limits into bounded numeric values', () => {
    expect(normalizeLeaderboardQueryParams({ period: 'month', limit: '20' })).toEqual({
      period: 'month',
      limit: 20,
    });
  });

  it('falls back to safe defaults when the query shape is invalid', () => {
    expect(normalizeLeaderboardQueryParams({ period: 'week', limit: 'abc' })).toEqual({
      period: 'all',
      limit: 20,
    });
  });
});

describe('rewardRoutes /leaderboard', () => {
  it('passes a numeric limit to the reward service even when the query value arrives as a string', async () => {
    testContext.rewardServiceMock.getLeaderboard.mockResolvedValue([{ rank: 1, points: 30 }]);
    const app = await createApp();
    openApps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/rewards/leaderboard?period=month&limit=20',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      period: 'month',
      limit: 20,
      leaderboard: [{ rank: 1, points: 30 }],
    });
    expect(testContext.rewardServiceMock.getLeaderboard).toHaveBeenCalledWith('month', 20);
  });
});

describe('rewardRoutes /me', () => {
  it('returns standardized error payloads when the authenticated user does not exist', async () => {
    const app = await createApp(null);
    openApps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/rewards/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'User not found',
      message: 'User not found',
    });
  });

  it('returns the user reward summary for a valid authenticated user', async () => {
    testContext.rewardServiceMock.getUserSummary.mockResolvedValue({
      points: 29,
      breakdown: [],
      recentRewards: [],
      ranks: { allTime: 3, monthly: 2 },
    });

    const app = await createApp({ id: 7 });
    openApps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/rewards/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      points: 29,
      breakdown: [],
      recentRewards: [],
      ranks: { allTime: 3, monthly: 2 },
    });
    expect(testContext.rewardServiceMock.getUserSummary).toHaveBeenCalledWith(7);
  });
});