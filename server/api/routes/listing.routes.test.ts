import fastify, { type FastifyInstance } from 'fastify';
import { Prisma, RewardAction } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config/config';
import { startOfUtcDay } from '../../utils/date-buckets';
import { anonymizeViewerKey } from '../../utils/viewer-key';
import { listingRoutes } from './listing.routes';

const testContext = vi.hoisted(() => ({
  tokenUsers: new Map<string, { sub: string }>(),
  rewardServiceMock: {
    maybeGrantUniqueListingViewReward: vi.fn(),
    maybeGrantBuyerFeedbackRewards: vi.fn(),
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
  optionalAuth: vi.fn(async (request: { headers: { authorization?: string }; user?: { sub: string } }, reply: { code: (statusCode: number) => { send: (body: unknown) => void } }) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return;
    }

    const token = authHeader.slice(7);
    const user = testContext.tokenUsers.get(token);
    if (user) {
      request.user = user;
    } else {
      reply.code(401).send({ error: 'Invalid token' });
    }
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
}

interface TestListing {
  id: number;
  userId: number;
}

interface TestContactReveal {
  listingId: number;
  buyerId: number;
  sellerId: number;
}

interface TestFeedback {
  id: number;
  listingId: number;
  buyerId: number;
  sellerId: number;
  rating: number;
  comment?: string;
}

interface TestListingView {
  id: number;
  listingId: number;
  viewerUserId?: number;
  viewerKey: string;
  viewedDay: Date;
}

interface TestRewardEvent {
  userId: number;
  action: RewardAction;
  sourceId: number;
}

interface TestState {
  usersByAuthId: Map<string, TestUser>;
  listingsById: Map<number, TestListing>;
  listingViewsByKey: Map<string, TestListingView>;
  contactRevealsByKey: Map<string, TestContactReveal>;
  feedbackByKey: Map<string, TestFeedback>;
  rewardEvents: TestRewardEvent[];
  nextListingViewId: number;
  nextFeedbackId: number;
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

function listingViewKey(listingId: number, viewerKey: string, viewedDay: Date): string {
  return `${listingId}:${viewerKey}:${viewedDay.toISOString()}`;
}

function feedbackKey(listingId: number, buyerId: number): string {
  return `${listingId}:${buyerId}`;
}

function createDuplicateFeedbackError() {
  const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
  return error;
}

function createTestState(): TestState {
  return {
    usersByAuthId: new Map<string, TestUser>([
      ['auth0|seller', { id: 1, userId: 'auth0|seller' }],
      ['auth0|buyer', { id: 2, userId: 'auth0|buyer' }],
    ]),
    listingsById: new Map<number, TestListing>([[10, { id: 10, userId: 1 }]]),
    listingViewsByKey: new Map(),
    contactRevealsByKey: new Map(),
    feedbackByKey: new Map(),
    rewardEvents: [],
    nextListingViewId: 1,
    nextFeedbackId: 1,
  };
}

function createPrismaMock(state: TestState) {
  return {
    user: {
      findUnique: vi.fn(async ({ where, select }: { where: { userId: string }; select?: Record<string, boolean> }) => {
        const user = state.usersByAuthId.get(where.userId) ?? null;
        return applySelect(user, select);
      }),
    },
    listing: {
      findUnique: vi.fn(async ({ where, select }: { where: { id?: number }; select?: Record<string, boolean> }) => {
        const listing = where.id ? state.listingsById.get(where.id) ?? null : null;
        return applySelect(listing, select);
      }),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    listingView: {
      create: vi.fn(async ({ data, select }: {
        data: {
          listingId: number;
          viewerUserId?: number;
          viewerKey: string;
          viewedDay: Date;
        };
        select?: Record<string, boolean>;
      }) => {
        const key = listingViewKey(data.listingId, data.viewerKey, data.viewedDay);
        if (state.listingViewsByKey.has(key)) {
          const duplicateError = Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
            meta: { target: ['listingId', 'viewerKey', 'viewedDay'] },
          });
          Object.setPrototypeOf(duplicateError, Prisma.PrismaClientKnownRequestError.prototype);
          throw duplicateError;
        }

        const createdRecord: TestListingView = {
          id: state.nextListingViewId++,
          listingId: data.listingId,
          viewerUserId: data.viewerUserId,
          viewerKey: data.viewerKey,
          viewedDay: data.viewedDay,
        };
        state.listingViewsByKey.set(key, createdRecord);
        return applySelect(createdRecord, select) as TestListingView;
      }),
    },
    contactReveal: {
      findUnique: vi.fn(async ({ where }: { where: { listingId_buyerId: { listingId: number; buyerId: number } } }) => {
        const composite = where.listingId_buyerId;
        return state.contactRevealsByKey.get(feedbackKey(composite.listingId, composite.buyerId)) ?? null;
      }),
    },
    listingFeedback: {
      create: vi.fn(async ({ data }: { data: Omit<TestFeedback, 'id'> }) => {
        const key = feedbackKey(data.listingId, data.buyerId);
        if (state.feedbackByKey.has(key)) {
          throw createDuplicateFeedbackError();
        }

        const feedback: TestFeedback = {
          id: state.nextFeedbackId++,
          ...data,
        };
        state.feedbackByKey.set(key, feedback);
        return feedback;
      }),
    },
  };
}

async function createApp() {
  const state = createTestState();
  const prisma = createPrismaMock(state);

  testContext.rewardServiceMock.maybeGrantUniqueListingViewReward.mockImplementation(
    async ({ sellerUserId, listingId, viewerKey }: { sellerUserId: number; listingId: number; viewerKey: string }) => {
      const rewardKey = `${sellerUserId}:${listingId}:${viewerKey}:${startOfUtcDay(new Date()).toISOString()}`;
      const alreadyGranted = state.rewardEvents.some(
        (event) =>
          event.action === RewardAction.LISTING_UNIQUE_VIEW &&
          `${event.userId}:${event.sourceId}:${viewerKey}:${startOfUtcDay(new Date()).toISOString()}` === rewardKey,
      );

      if (!alreadyGranted) {
        state.rewardEvents.push({
          userId: sellerUserId,
          action: RewardAction.LISTING_UNIQUE_VIEW,
          sourceId: listingId,
        });
      }

      return {
        reward: alreadyGranted ? null : { id: state.rewardEvents.length },
        created: !alreadyGranted,
      };
    },
  );

  testContext.rewardServiceMock.maybeGrantBuyerFeedbackRewards.mockImplementation(
    async ({ listingId, buyerId, sellerId }: { listingId: number; buyerId: number; sellerId: number }) => {
      state.rewardEvents.push(
        {
          userId: buyerId,
          action: RewardAction.BUYER_FEEDBACK_SUBMITTED,
          sourceId: listingId,
        },
        {
          userId: sellerId,
          action: RewardAction.BUYER_FEEDBACK_RECEIVED,
          sourceId: listingId,
        },
      );

      return {
        buyerReward: { reward: { id: state.rewardEvents.length - 1 }, created: true },
        sellerReward: { reward: { id: state.rewardEvents.length }, created: true },
      };
    },
  );

  const app = fastify();
  app.decorate('prisma', prisma as never);
  await app.register(listingRoutes, { prefix: '/listings' });
  await app.ready();

  return { app, prisma, state };
}

const openApps: FastifyInstance[] = [];

beforeEach(() => {
  testContext.tokenUsers.clear();
  testContext.tokenUsers.set('seller-token', { sub: 'auth0|seller' });
  testContext.tokenUsers.set('buyer-token', { sub: 'auth0|buyer' });
  testContext.rewardServiceMock.maybeGrantUniqueListingViewReward.mockReset();
  testContext.rewardServiceMock.maybeGrantBuyerFeedbackRewards.mockReset();
});

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe('listingRoutes view tracking', () => {
  it('preserves the non-expired filter when search terms are applied to listing browse queries', async () => {
    const { app, prisma } = await createApp();
    openApps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/listings?search=phone',
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.listing.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          AND: [
            {
              OR: [
                { republishedAt: { gte: expect.any(Date) } },
                { republishedAt: null, createdAt: { gte: expect.any(Date) } },
              ],
            },
            {
              OR: [
                { title: { contains: 'phone', mode: 'insensitive' } },
                { description: { contains: 'phone', mode: 'insensitive' } },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('does not create a duplicate listingView for repeated views on the same UTC day', async () => {
    const { app, state } = await createApp();
    openApps.push(app);

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/listings/10/view',
      headers: {
        authorization: 'Bearer buyer-token',
      },
    });

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/listings/10/view',
      headers: {
        authorization: 'Bearer buyer-token',
      },
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toMatchObject({ tracked: true, rewardGranted: true });
    expect(secondResponse.json()).toMatchObject({ tracked: false, uniqueViewId: null, rewardGranted: false });
    expect(state.listingViewsByKey.size).toBe(1);
    expect(testContext.rewardServiceMock.maybeGrantUniqueListingViewReward).toHaveBeenCalledTimes(1);
  });

  it('persists the normalized UTC day bucket for a tracked listing view', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T18:45:33.123Z'));

    try {
      const { app, prisma } = await createApp();
      openApps.push(app);

      const response = await app.inject({
        method: 'POST',
        url: '/listings/10/view',
        headers: {
          authorization: 'Bearer buyer-token',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.listingView.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            listingId: 10,
            viewerKey: anonymizeViewerKey(
              'user',
              'auth0|buyer',
              config.server.viewerKeySecret,
            ),
            viewedDay: new Date('2026-06-14T00:00:00.000Z'),
          }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('suppresses tracked views for the listing owner', async () => {
    const { app, prisma } = await createApp();
    openApps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/listings/10/view',
      headers: {
        authorization: 'Bearer seller-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ tracked: false, reason: 'owner-view' });
    expect(prisma.listingView.create).not.toHaveBeenCalled();
    expect(testContext.rewardServiceMock.maybeGrantUniqueListingViewReward).not.toHaveBeenCalled();
  });

  it('returns 401 and skips tracking when the bearer token is present but invalid', async () => {
    const { app } = await createApp();
    openApps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/listings/10/view',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(testContext.rewardServiceMock.maybeGrantUniqueListingViewReward).not.toHaveBeenCalled();
  });
});

describe('listingRoutes feedback submission', () => {
  it('rejects feedback from the seller on their own listing', async () => {
    const { app, prisma } = await createApp();
    openApps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/listings/10/feedback',
      headers: {
        authorization: 'Bearer seller-token',
      },
      payload: {
        rating: 5,
        comment: 'Self review',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'You cannot leave feedback on your own listing',
    });
    expect(prisma.listingFeedback.create).not.toHaveBeenCalled();
    expect(testContext.rewardServiceMock.maybeGrantBuyerFeedbackRewards).not.toHaveBeenCalled();
  });

  it('rejects feedback when the buyer has not revealed contact details first', async () => {
    const { app, prisma } = await createApp();
    openApps.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/listings/10/feedback',
      headers: {
        authorization: 'Bearer buyer-token',
      },
      payload: {
        rating: 5,
        comment: 'Great seller',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: 'Reveal contact information before leaving feedback',
    });
    expect(prisma.listingFeedback.create).not.toHaveBeenCalled();
    expect(testContext.rewardServiceMock.maybeGrantBuyerFeedbackRewards).not.toHaveBeenCalled();
  });

  it('returns 409 when duplicate feedback is submitted for the same listing by the same buyer', async () => {
    const { app, state } = await createApp();
    openApps.push(app);
    state.contactRevealsByKey.set(feedbackKey(10, 2), {
      listingId: 10,
      buyerId: 2,
      sellerId: 1,
    });
    state.feedbackByKey.set(feedbackKey(10, 2), {
      id: 99,
      listingId: 10,
      buyerId: 2,
      sellerId: 1,
      rating: 4,
      comment: 'Already sent',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/listings/10/feedback',
      headers: {
        authorization: 'Bearer buyer-token',
      },
      payload: {
        rating: 5,
        comment: 'Trying again',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'Feedback has already been submitted for this listing',
    });
    expect(testContext.rewardServiceMock.maybeGrantBuyerFeedbackRewards).not.toHaveBeenCalled();
  });

  it('creates feedback and grants buyer and seller reward events after contact reveal', async () => {
    const { app, state } = await createApp();
    openApps.push(app);
    state.contactRevealsByKey.set(feedbackKey(10, 2), {
      listingId: 10,
      buyerId: 2,
      sellerId: 1,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/listings/10/feedback',
      headers: {
        authorization: 'Bearer buyer-token',
      },
      payload: {
        rating: 5,
        comment: 'Smooth transaction',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().feedback).toMatchObject({
      listingId: 10,
      buyerId: 2,
      sellerId: 1,
      rating: 5,
      comment: 'Smooth transaction',
    });
    expect(testContext.rewardServiceMock.maybeGrantBuyerFeedbackRewards).toHaveBeenCalledWith({
      listingId: 10,
      buyerId: 2,
      sellerId: 1,
      rating: 5,
    });
    expect(state.rewardEvents).toEqual([
      {
        userId: 2,
        action: RewardAction.BUYER_FEEDBACK_SUBMITTED,
        sourceId: 10,
      },
      {
        userId: 1,
        action: RewardAction.BUYER_FEEDBACK_RECEIVED,
        sourceId: 10,
      },
    ]);
  });
});
