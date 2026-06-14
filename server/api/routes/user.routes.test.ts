import fastify, { type FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userRoutes } from './user.routes';

const testContext = vi.hoisted(() => ({
  tokenUsers: new Map<string, { sub: string }>(),
  rewardServiceMock: {
    maybeGrantDailyLoginReward: vi.fn(),
    maybeGrantProfileCompletionReward: vi.fn(),
  },
}));

vi.mock('../../middleware/auth', () => ({
  verifyAuth0Token: vi.fn(async (request: { headers: { authorization?: string }; user?: { sub: string } }, reply: { code: (statusCode: number) => { send: (body: unknown) => void }, sent: boolean }) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Missing Authorization header' });
      reply.sent = true;
      return false;
    }

    const token = authHeader.slice(7);
    const user = testContext.tokenUsers.get(token);
    if (!user) {
      reply.code(401).send({ error: 'Invalid token' });
      reply.sent = true;
      return false;
    }

    request.user = user;
    return true;
  }),
}));

vi.mock('../../services/reward.service', () => ({
  RewardService: class RewardService {
    constructor() {
      return testContext.rewardServiceMock;
    }
  },
}));

interface TestUser {
  id: number;
  userId: string;
  username?: string | null;
  email?: string | null;
  fullName?: string | null;
  avatar?: string | null;
  lastLogin?: Date | null;
}

interface TestState {
  usersByAuthId: Map<string, TestUser>;
  nextUserId: number;
}

function applySelect<T extends object>(
  record: T | null,
  select?: Record<string, boolean>,
) {
  if (!record || !select) {
    return record;
  }

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, include]) => include)
      .map(([key]) => [key, record[key as keyof T]]),
  );
}

function createTestState(): TestState {
  return {
    usersByAuthId: new Map<string, TestUser>([
      ['auth0|existing_user', { id: 1, userId: 'auth0|existing_user', email: 'existing@example.com' }],
      ['auth0|existing_no_profile', { id: 2, userId: 'auth0|existing_no_profile' }],
    ]),
    nextUserId: 3,
  };
}

function createPrismaMock(state: TestState) {
  return {
    user: {
      findUnique: vi.fn(async ({ where, select }: { where: { userId?: string, id?: number }; select?: Record<string, boolean> }) => {
        let user: TestUser | null = null;
        if (where.userId) {
          user = state.usersByAuthId.get(where.userId) ?? null;
        } else if (where.id) {
          user = Array.from(state.usersByAuthId.values()).find(u => u.id === where.id) ?? null;
        }
        return applySelect(user, select);
      }),
      create: vi.fn(async ({ data, select }: { data: any, select?: Record<string, boolean> }) => {
        const newUser: TestUser = {
          id: state.nextUserId++,
          ...data,
        };
        state.usersByAuthId.set(newUser.userId, newUser);
        return applySelect(newUser, select);
      }),
      update: vi.fn(async ({ where, data, select }: { where: { userId: string }, data: any, select?: Record<string, boolean> }) => {
        const user = state.usersByAuthId.get(where.userId);
        if (!user) throw new Error('User not found');
        
        const updatedUser = { ...user, ...data };
        state.usersByAuthId.set(where.userId, updatedUser);
        return applySelect(updatedUser, select);
      }),
    },
  };
}

async function createApp() {
  const state = createTestState();
  const prisma = createPrismaMock(state);

  const app = fastify();
  app.decorate('prisma', prisma as never);
  await app.register(userRoutes, { prefix: '/users' });
  await app.ready();

  return { app, prisma, state };
}

const openApps: FastifyInstance[] = [];

beforeEach(() => {
  testContext.tokenUsers.clear();
  testContext.tokenUsers.set('existing-token', { sub: 'auth0|existing_user' });
  testContext.tokenUsers.set('new-token', { sub: 'auth0|new_user' });
  testContext.tokenUsers.set('existing-no-profile-token', { sub: 'auth0|existing_no_profile' });
  
  testContext.rewardServiceMock.maybeGrantDailyLoginReward.mockReset();
  testContext.rewardServiceMock.maybeGrantProfileCompletionReward.mockReset();
});

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe('userRoutes POST /', () => {
  it('creates a new user and grants login/profile rewards', async () => {
    const { app, prisma, state } = await createApp();
    openApps.push(app);

    const payload = {
      userId: 'auth0|new_user',
      email: 'new@example.com',
      fullName: 'New User',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/users/',
      headers: {
        authorization: 'Bearer new-token',
      },
      payload,
    });

    expect(response.statusCode).toBe(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'auth0|new_user',
          email: 'new@example.com',
          fullName: 'New User',
        }),
      })
    );
    expect(testContext.rewardServiceMock.maybeGrantDailyLoginReward).toHaveBeenCalledTimes(1);
    expect(testContext.rewardServiceMock.maybeGrantProfileCompletionReward).toHaveBeenCalledTimes(1);
  });

  it('updates lastLogin and syncs profile for an existing user missing profile fields', async () => {
    const { app, prisma, state } = await createApp();
    openApps.push(app);

      const payload = {
        userId: 'auth0|existing_no_profile',
        email: 'synced@example.com',
        fullName: 'Synced Name',
        avatar: 'https://example.com/avatar.png',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users/',
        headers: {
          authorization: 'Bearer existing-no-profile-token',
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'auth0|existing_no_profile' },
          data: expect.objectContaining({
            lastLogin: expect.any(Date),
            email: 'synced@example.com',
            fullName: 'Synced Name',
            avatar: 'https://example.com/avatar.png',
          }),
        })
      );
      expect(testContext.rewardServiceMock.maybeGrantDailyLoginReward).toHaveBeenCalledTimes(1);
      // Profile completion reward is not granted on login endpoint for existing users, only on create or PATCH.
  });

  it('does not overwrite existing profile fields if they are already present', async () => {
    const { app, prisma, state } = await createApp();
    openApps.push(app);

      // This user already has an email 'existing@example.com' in the mock state
      const payload = {
        userId: 'auth0|existing_user',
        email: 'shouldnotoverwrite@example.com',
        fullName: 'New Name',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/users/',
        headers: {
          authorization: 'Bearer existing-token',
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'auth0|existing_user' },
          data: {
            lastLogin: expect.any(Date),
            // email is omitted because existingUser.email is present
            fullName: 'New Name',
          },
        })
      );
  });

  it('returns 401 when missing bearer token', async () => {
    const { app } = await createApp();
    openApps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/users/',
      payload: {
        userId: 'auth0|new_user',
        email: 'new@example.com',
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
