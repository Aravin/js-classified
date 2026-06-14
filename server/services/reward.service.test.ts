import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Prisma, RewardAction } from '@prisma/client';
import {
  RewardService,
  buildDailyLoginDedupeKey,
  buildBuyerFeedbackReceivedDedupeKey,
  buildBuyerFeedbackSubmittedDedupeKey,
  buildListingViewDedupeKey,
  buildProfileCompleteDedupeKey,
  buildPublishDedupeKey,
  buildRepublishDedupeKey,
  isProfileComplete,
  REWARD_POINTS,
} from './reward.service';

function createPrismaMock() {
  const tx = {
    rewardEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    $queryRaw: vi.fn(),
    rewardEvent: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  };

  return { prisma, tx };
}

describe('reward helpers', () => {
  it('builds a stable daily login dedupe key for a UTC day', () => {
    const key = buildDailyLoginDedupeKey('auth0|abc', new Date('2026-06-13T17:45:00.000Z'));
    expect(key).toBe('login:auth0|abc:2026-06-13');
  });

  it('builds publish and republish dedupe keys', () => {
    expect(buildPublishDedupeKey(42)).toBe('publish:42');
    expect(buildRepublishDedupeKey(42, 3)).toBe('republish:42:3');
    expect(buildProfileCompleteDedupeKey(7)).toBe('profile-complete:7');
    expect(buildListingViewDedupeKey(42, 'viewer:abc', new Date('2026-06-13T04:00:00.000Z'))).toBe(
      'listing-view:42:viewer:abc:2026-06-13',
    );
    expect(buildBuyerFeedbackSubmittedDedupeKey(42, 5)).toBe('feedback-submitted:42:5');
    expect(buildBuyerFeedbackReceivedDedupeKey(42, 7, 5)).toBe('feedback-received:42:7:5');
  });

  it('detects profile completeness only when all required fields exist', () => {
    expect(
      isProfileComplete({
        email: 'user@example.com',
        phone: '+1234567890',
        fullName: 'Test User',
        avatar: 'https://example.com/avatar.png',
      }),
    ).toBe(true);

    expect(
      isProfileComplete({
        email: 'user@example.com',
        phone: null,
        fullName: 'Test User',
        avatar: 'https://example.com/avatar.png',
      }),
    ).toBe(false);
  });
});

describe('RewardService.grantReward', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an existing reward without mutating user points when create hits a duplicate dedupe key', async () => {
    const { prisma, tx } = createPrismaMock();
    const existingReward = {
      id: 10,
      userId: 2,
      action: RewardAction.DAILY_LOGIN,
      points: REWARD_POINTS[RewardAction.DAILY_LOGIN],
      dedupeKey: 'login:auth0|abc:2026-06-13',
    };

    const duplicateError = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['dedupeKey'] },
    });
    Object.setPrototypeOf(duplicateError, Prisma.PrismaClientKnownRequestError.prototype);

    tx.rewardEvent.create.mockRejectedValue(duplicateError);
    tx.rewardEvent.findUnique.mockResolvedValue(existingReward);

    const service = new RewardService(prisma as never);
    const result = await service.grantReward({
      userId: 2,
      action: RewardAction.DAILY_LOGIN,
      dedupeKey: existingReward.dedupeKey,
    });

    expect(result).toEqual({ reward: existingReward, created: false });
    expect(tx.rewardEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 2,
        action: RewardAction.DAILY_LOGIN,
        points: REWARD_POINTS[RewardAction.DAILY_LOGIN],
        dedupeKey: existingReward.dedupeKey,
      }),
    });
    expect(tx.rewardEvent.findUnique).toHaveBeenCalledWith({
      where: { dedupeKey: existingReward.dedupeKey },
    });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rethrows a P2002 that targets a different unique constraint, not dedupeKey', async () => {
    const { prisma, tx } = createPrismaMock();

    const otherConstraintError = Object.assign(new Error('Unique constraint failed on userId'), {
      code: 'P2002',
      meta: { target: ['userId'] },
    });
    Object.setPrototypeOf(otherConstraintError, Prisma.PrismaClientKnownRequestError.prototype);

    tx.rewardEvent.create.mockRejectedValue(otherConstraintError);

    const service = new RewardService(prisma as never);
    await expect(
      service.grantReward({
        userId: 2,
        action: RewardAction.DAILY_LOGIN,
        dedupeKey: 'login:auth0|abc:2026-06-13',
      }),
    ).rejects.toThrow('Unique constraint failed on userId');

    expect(tx.rewardEvent.findUnique).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rethrows a P2002 with no meta.target without masking the error', async () => {
    const { prisma, tx } = createPrismaMock();

    const bareP2002 = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: {},
    });
    Object.setPrototypeOf(bareP2002, Prisma.PrismaClientKnownRequestError.prototype);

    tx.rewardEvent.create.mockRejectedValue(bareP2002);

    const service = new RewardService(prisma as never);
    await expect(
      service.grantReward({
        userId: 2,
        action: RewardAction.DAILY_LOGIN,
        dedupeKey: 'login:auth0|abc:2026-06-13',
      }),
    ).rejects.toThrow('Unique constraint failed');

    expect(tx.rewardEvent.findUnique).not.toHaveBeenCalled();
  });

  it('creates a reward and increments reward points when no duplicate exists', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.rewardEvent.create.mockResolvedValue({
      id: 11,
      action: RewardAction.LISTING_PUBLISHED,
      points: REWARD_POINTS[RewardAction.LISTING_PUBLISHED],
    });

    const service = new RewardService(prisma as never);
    const result = await service.grantReward({
      userId: 4,
      action: RewardAction.LISTING_PUBLISHED,
      dedupeKey: 'publish:22',
      sourceType: 'listing',
      sourceId: 22,
    });

    expect(result.created).toBe(true);
    expect(tx.rewardEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 4,
        action: RewardAction.LISTING_PUBLISHED,
        points: REWARD_POINTS[RewardAction.LISTING_PUBLISHED],
        dedupeKey: 'publish:22',
        sourceType: 'listing',
        sourceId: 22,
      }),
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: {
        rewardPoints: {
          increment: REWARD_POINTS[RewardAction.LISTING_PUBLISHED],
        },
      },
    });
  });
});

describe('RewardService wrapper methods', () => {
  it('skips profile completion rewards for incomplete users', async () => {
    const { prisma } = createPrismaMock();
    const service = new RewardService(prisma as never);
    const grantSpy = vi.spyOn(service, 'grantReward');

    const result = await service.maybeGrantProfileCompletionReward({
      id: 9,
      email: 'user@example.com',
      phone: null,
      fullName: 'Test User',
      avatar: 'https://example.com/avatar.png',
    });

    expect(result).toEqual({ reward: null, created: false });
    expect(grantSpy).not.toHaveBeenCalled();
  });

  it('grants profile completion rewards for complete users with the right action and key', async () => {
    const { prisma } = createPrismaMock();
    const service = new RewardService(prisma as never);
    const grantSpy = vi.spyOn(service, 'grantReward').mockResolvedValue({
      reward: { id: 1 },
      created: true,
    } as never);

    await service.maybeGrantProfileCompletionReward({
      id: 9,
      email: 'user@example.com',
      phone: '+1234567890',
      fullName: 'Test User',
      avatar: 'https://example.com/avatar.png',
    });

    expect(grantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        action: RewardAction.PROFILE_COMPLETED,
        dedupeKey: 'profile-complete:9',
      }),
    );
  });

  it('grants unique listing view rewards with listing-view metadata', async () => {
    const { prisma } = createPrismaMock();
    const service = new RewardService(prisma as never);
    const grantSpy = vi.spyOn(service, 'grantReward').mockResolvedValue({
      reward: { id: 2 },
      created: true,
    } as never);

    await service.maybeGrantUniqueListingViewReward({
      sellerUserId: 11,
      listingId: 22,
      viewerKey: 'ip:127.0.0.1',
      viewedAt: new Date('2026-06-13T03:00:00.000Z'),
    });

    expect(grantSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 11,
        action: RewardAction.LISTING_UNIQUE_VIEW,
        dedupeKey: 'listing-view:22:ip:127.0.0.1:2026-06-13',
        sourceType: 'listing-view',
        sourceId: 22,
      }),
    );
  });

  it('grants buyer and seller feedback rewards with separate actions', async () => {
    const { prisma } = createPrismaMock();
    const service = new RewardService(prisma as never);
    const grantSpy = vi.spyOn(service, 'grantReward').mockResolvedValue({
      reward: { id: 3 },
      created: true,
    } as never);

    await service.maybeGrantBuyerFeedbackRewards({
      listingId: 33,
      buyerId: 4,
      sellerId: 9,
      rating: 5,
    });

    expect(grantSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 4,
        action: RewardAction.BUYER_FEEDBACK_SUBMITTED,
        dedupeKey: 'feedback-submitted:33:4',
      }),
    );
    expect(grantSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 9,
        action: RewardAction.BUYER_FEEDBACK_RECEIVED,
        dedupeKey: 'feedback-received:33:9:4',
      }),
    );
  });

  it('builds a monthly leaderboard query using the current month boundary', async () => {
    const { prisma } = createPrismaMock();
    prisma.rewardEvent.groupBy.mockResolvedValue([
      { userId: 3, _sum: { points: 25 } },
      { userId: 4, _sum: { points: 10 } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 3, userId: 'auth0|3', username: 'alpha', fullName: 'Alpha', avatar: null },
      { id: 4, userId: 'auth0|4', username: 'beta', fullName: 'Beta', avatar: null },
    ]);

    const service = new RewardService(prisma as never);
    const leaderboard = await service.getLeaderboard('month', 5);

    expect(prisma.rewardEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: expect.any(Date),
          },
        },
        take: 5,
      }),
    );
    expect(leaderboard).toEqual([
      expect.objectContaining({ rank: 1, userId: 3, points: 25, username: 'alpha' }),
      expect.objectContaining({ rank: 2, userId: 4, points: 10, username: 'beta' }),
    ]);
  });

  it('returns contiguous ranks after filtering out grouped users missing from the user table', async () => {
    const { prisma } = createPrismaMock();
    prisma.rewardEvent.groupBy.mockResolvedValue([
      { userId: 3, _sum: { points: 30 } },
      { userId: 999, _sum: { points: 20 } },
      { userId: 4, _sum: { points: 10 } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 3, userId: 'auth0|3', username: 'alpha', fullName: 'Alpha', avatar: null },
      { id: 4, userId: 'auth0|4', username: 'beta', fullName: 'Beta', avatar: null },
    ]);

    const service = new RewardService(prisma as never);
    const leaderboard = await service.getLeaderboard('all', 5);

    expect(leaderboard).toEqual([
      expect.objectContaining({ rank: 1, userId: 3, points: 30, username: 'alpha' }),
      expect.objectContaining({ rank: 2, userId: 4, points: 10, username: 'beta' }),
    ]);
  });

  it('uses the same userId tie-break as getUserRank when leaderboard scores are equal', async () => {
    const { prisma } = createPrismaMock();
    prisma.rewardEvent.groupBy.mockResolvedValue([
      { userId: 2, _sum: { points: 20 } },
      { userId: 5, _sum: { points: 20 } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 2, userId: 'auth0|2', username: 'alpha', fullName: 'Alpha', avatar: null },
      { id: 5, userId: 'auth0|5', username: 'beta', fullName: 'Beta', avatar: null },
    ]);

    const service = new RewardService(prisma as never);
    const leaderboard = await service.getLeaderboard('all', 10);

    expect(prisma.rewardEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            _sum: {
              points: 'desc',
            },
          },
          {
            userId: 'asc',
          },
        ],
      }),
    );
    expect(leaderboard).toEqual([
      expect.objectContaining({ rank: 1, userId: 2, points: 20, username: 'alpha' }),
      expect.objectContaining({ rank: 2, userId: 5, points: 20, username: 'beta' }),
    ]);
  });

  it('combines reward history and derived ranks in the user summary', async () => {
    const { prisma } = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({ rewardPoints: 44 });
    prisma.rewardEvent.groupBy.mockResolvedValue([
      {
        action: RewardAction.LISTING_PUBLISHED,
        _count: { action: 2 },
        _sum: { points: 20 },
      },
      {
        action: RewardAction.DAILY_LOGIN,
        _count: { action: 1 },
        _sum: { points: 5 },
      },
    ]);
    prisma.rewardEvent.findMany.mockResolvedValue([
      {
        id: 1,
        action: RewardAction.DAILY_LOGIN,
        points: 5,
        createdAt: new Date('2026-06-13T00:00:00.000Z'),
        sourceType: null,
        sourceId: null,
        metadata: null,
      },
    ]);

    const service = new RewardService(prisma as never);
    vi.spyOn(service, 'getUserRank')
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);

    const summary = await service.getUserSummary(2);

    expect(summary.points).toBe(44);
    expect(summary.breakdown).toEqual([
      {
        action: RewardAction.LISTING_PUBLISHED,
        title: 'Publish a listing',
        count: 2,
        points: 20,
      },
      {
        action: RewardAction.DAILY_LOGIN,
        title: 'Daily login',
        count: 1,
        points: 5,
      },
    ]);
    expect(summary.recentRewards).toHaveLength(1);
    expect(summary.ranks).toEqual({ allTime: 1, monthly: 3 });
  });

  it('computes the exact user rank without a leaderboard limit', async () => {
    const { prisma } = createPrismaMock();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ rank: 2 }])
      .mockResolvedValueOnce([]);

    const service = new RewardService(prisma as never);

    await expect(service.getUserRank(20, 'all')).resolves.toBe(2);
    await expect(service.getUserRank(999, 'all')).resolves.toBeNull();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});