import { PrismaClient, RewardAction, Prisma } from '@prisma/client';
import { startOfUtcDay } from '../utils/date-buckets';

export const REWARD_POINTS: Record<RewardAction, number> = {
  [RewardAction.DAILY_LOGIN]: 5,
  [RewardAction.LISTING_PUBLISHED]: 10,
  [RewardAction.LISTING_REPUBLISHED]: 4,
  [RewardAction.PROFILE_COMPLETED]: 15,
  [RewardAction.LISTING_UNIQUE_VIEW]: 2,
  [RewardAction.BUYER_FEEDBACK_SUBMITTED]: 6,
  [RewardAction.BUYER_FEEDBACK_RECEIVED]: 8,
};

export const REWARD_CATALOG: Array<{
  action: RewardAction;
  points: number;
  title: string;
  description: string;
}> = [
  {
    action: RewardAction.DAILY_LOGIN,
    points: REWARD_POINTS[RewardAction.DAILY_LOGIN],
    title: 'Daily login',
    description: 'Earn points once per calendar day when you sign in.',
  },
  {
    action: RewardAction.LISTING_PUBLISHED,
    points: REWARD_POINTS[RewardAction.LISTING_PUBLISHED],
    title: 'Publish a listing',
    description: 'Earn points when a draft listing goes live for the first time.',
  },
  {
    action: RewardAction.LISTING_REPUBLISHED,
    points: REWARD_POINTS[RewardAction.LISTING_REPUBLISHED],
    title: 'Republish a listing',
    description: 'Earn points each time you refresh an expired listing back to active.',
  },
  {
    action: RewardAction.PROFILE_COMPLETED,
    points: REWARD_POINTS[RewardAction.PROFILE_COMPLETED],
    title: 'Complete your profile',
    description: 'Earn a one-time reward when email, phone, name, and avatar are all present.',
  },
  {
    action: RewardAction.LISTING_UNIQUE_VIEW,
    points: REWARD_POINTS[RewardAction.LISTING_UNIQUE_VIEW],
    title: 'Unique listing view',
    description: 'Earn points when a buyer or visitor views your listing for the first time that day.',
  },
  {
    action: RewardAction.BUYER_FEEDBACK_SUBMITTED,
    points: REWARD_POINTS[RewardAction.BUYER_FEEDBACK_SUBMITTED],
    title: 'Buyer feedback submitted',
    description: 'Earn points when you submit eligible feedback after revealing seller contact info.',
  },
  {
    action: RewardAction.BUYER_FEEDBACK_RECEIVED,
    points: REWARD_POINTS[RewardAction.BUYER_FEEDBACK_RECEIVED],
    title: 'Buyer feedback received',
    description: 'Earn points when your listing receives valid buyer feedback.',
  },
];

const REWARD_CATALOG_MAP = new Map(REWARD_CATALOG.map((item) => [item.action, item]));

export type LeaderboardPeriod = 'all' | 'month';

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
    createdAt: Date;
    sourceType: string | null;
    sourceId: number | null;
    metadata: Prisma.JsonValue | null;
  }>;
  ranks: {
    allTime: number | null;
    monthly: number | null;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string | null;
  fullName: string | null;
  avatar: string | null;
  points: number;
}

type LeaderboardEntryWithoutRank = Omit<LeaderboardEntry, 'rank'>;

export interface GrantRewardInput {
  userId: number;
  action: RewardAction;
  dedupeKey: string;
  sourceType?: string;
  sourceId?: number;
  metadata?: Prisma.InputJsonValue;
  points?: number;
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getPeriodStart(period: LeaderboardPeriod): Date | null {
  if (period === 'month') {
    return startOfUtcMonth(new Date());
  }

  return null;
}

export function buildDailyLoginDedupeKey(authUserId: string, date = new Date()): string {
  return `login:${authUserId}:${startOfUtcDay(date).toISOString().slice(0, 10)}`;
}

export function buildPublishDedupeKey(listingId: number): string {
  return `publish:${listingId}`;
}

export function buildRepublishDedupeKey(listingId: number, republishCount: number): string {
  return `republish:${listingId}:${republishCount}`;
}

export function buildProfileCompleteDedupeKey(userId: number): string {
  return `profile-complete:${userId}`;
}

export function buildListingViewDedupeKey(listingId: number, viewerKey: string, date = new Date()): string {
  return `listing-view:${listingId}:${viewerKey}:${startOfUtcDay(date).toISOString().slice(0, 10)}`;
}

export function buildBuyerFeedbackSubmittedDedupeKey(listingId: number, buyerId: number): string {
  return `feedback-submitted:${listingId}:${buyerId}`;
}

export function buildBuyerFeedbackReceivedDedupeKey(listingId: number, sellerId: number, buyerId: number): string {
  return `feedback-received:${listingId}:${sellerId}:${buyerId}`;
}

export function isProfileComplete(user: {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  avatar?: string | null;
}): boolean {
  return Boolean(user.email && user.phone && user.fullName && user.avatar);
}

export class RewardService {
  constructor(private prisma: PrismaClient) {}

  async grantReward(input: GrantRewardInput) {
    const points = input.points ?? REWARD_POINTS[input.action];

    return this.prisma.$transaction(async (tx) => {
      try {
        const reward = await tx.rewardEvent.create({
          data: {
            userId: input.userId,
            action: input.action,
            points,
            dedupeKey: input.dedupeKey,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            metadata: input.metadata,
          },
        });

        await tx.user.update({
          where: { id: input.userId },
          data: {
            rewardPoints: {
              increment: points,
            },
          },
        });

        return { reward, created: true };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          (error.meta.target as string[]).includes('dedupeKey')
        ) {
          const existingReward = await tx.rewardEvent.findUnique({
            where: { dedupeKey: input.dedupeKey },
          });

          if (existingReward) {
            return { reward: existingReward, created: false };
          }
        }

        throw error;
      }
    });
  }

  async maybeGrantDailyLoginReward(user: { id: number; userId: string }, date = new Date()) {
    return this.grantReward({
      userId: user.id,
      action: RewardAction.DAILY_LOGIN,
      dedupeKey: buildDailyLoginDedupeKey(user.userId, date),
      metadata: {
        date: startOfUtcDay(date).toISOString().slice(0, 10),
      },
    });
  }

  async maybeGrantPublishReward(userId: number, listingId: number) {
    return this.grantReward({
      userId,
      action: RewardAction.LISTING_PUBLISHED,
      dedupeKey: buildPublishDedupeKey(listingId),
      sourceType: 'listing',
      sourceId: listingId,
    });
  }

  async maybeGrantRepublishReward(userId: number, listingId: number, republishCount: number) {
    return this.grantReward({
      userId,
      action: RewardAction.LISTING_REPUBLISHED,
      dedupeKey: buildRepublishDedupeKey(listingId, republishCount),
      sourceType: 'listing',
      sourceId: listingId,
      metadata: {
        republishCount,
      },
    });
  }

  async maybeGrantProfileCompletionReward(user: {
    id: number;
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
    avatar?: string | null;
  }) {
    if (!isProfileComplete(user)) {
      return { reward: null, created: false };
    }

    return this.grantReward({
      userId: user.id,
      action: RewardAction.PROFILE_COMPLETED,
      dedupeKey: buildProfileCompleteDedupeKey(user.id),
      metadata: {
        fields: ['email', 'phone', 'fullName', 'avatar'],
      },
    });
  }

  async maybeGrantUniqueListingViewReward(input: {
    sellerUserId: number;
    listingId: number;
    viewerKey: string;
    viewedAt?: Date;
  }) {
    const viewedAt = input.viewedAt ?? new Date();

    return this.grantReward({
      userId: input.sellerUserId,
      action: RewardAction.LISTING_UNIQUE_VIEW,
      dedupeKey: buildListingViewDedupeKey(input.listingId, input.viewerKey, viewedAt),
      sourceType: 'listing-view',
      sourceId: input.listingId,
      metadata: {
        viewerKey: input.viewerKey,
        viewedDay: startOfUtcDay(viewedAt).toISOString(),
      },
    });
  }

  async maybeGrantBuyerFeedbackRewards(input: {
    listingId: number;
    buyerId: number;
    sellerId: number;
    rating: number;
  }) {
    const [buyerReward, sellerReward] = await Promise.all([
      this.grantReward({
        userId: input.buyerId,
        action: RewardAction.BUYER_FEEDBACK_SUBMITTED,
        dedupeKey: buildBuyerFeedbackSubmittedDedupeKey(input.listingId, input.buyerId),
        sourceType: 'listing-feedback',
        sourceId: input.listingId,
        metadata: {
          rating: input.rating,
          sellerId: input.sellerId,
        },
      }),
      this.grantReward({
        userId: input.sellerId,
        action: RewardAction.BUYER_FEEDBACK_RECEIVED,
        dedupeKey: buildBuyerFeedbackReceivedDedupeKey(
          input.listingId,
          input.sellerId,
          input.buyerId,
        ),
        sourceType: 'listing-feedback',
        sourceId: input.listingId,
        metadata: {
          rating: input.rating,
          buyerId: input.buyerId,
        },
      }),
    ]);

    return { buyerReward, sellerReward };
  }

  async getUserSummary(userId: number): Promise<RewardSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        rewardPoints: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const breakdownGroups = await this.prisma.rewardEvent.groupBy({
      by: ['action'],
      where: { userId },
      _count: {
        action: true,
      },
      _sum: {
        points: true,
      },
      orderBy: {
        _sum: {
          points: 'desc',
        },
      },
    });

    const recentRewards = await this.prisma.rewardEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        points: true,
        createdAt: true,
        sourceType: true,
        sourceId: true,
        metadata: true,
      },
    });

    const [allTimeRank, monthlyRank] = await Promise.all([
      this.getUserRank(userId, 'all'),
      this.getUserRank(userId, 'month'),
    ]);

    return {
      points: user.rewardPoints,
      breakdown: breakdownGroups.map((entry) => {
        const catalogItem = REWARD_CATALOG_MAP.get(entry.action);

        return {
          action: entry.action,
          title: catalogItem?.title ?? entry.action,
          count: entry._count.action,
          points: entry._sum.points ?? 0,
        };
      }),
      recentRewards,
      ranks: {
        allTime: allTimeRank,
        monthly: monthlyRank,
      },
    };
  }

  async getUserRank(userId: number, period: LeaderboardPeriod): Promise<number | null> {
    const periodStart = getPeriodStart(period);
    const periodFilter = periodStart
      ? Prisma.sql`WHERE "createdAt" >= ${periodStart}`
      : Prisma.empty;

    const rankedUsers = await this.prisma.$queryRaw<Array<{ rank: number }>>(Prisma.sql`
      WITH user_totals AS (
        SELECT
          "userId",
          SUM("points") AS total_points
        FROM "rewardEvent"
        ${periodFilter}
        GROUP BY "userId"
      ),
      ranked_users AS (
        SELECT
          "userId",
          CAST(ROW_NUMBER() OVER (ORDER BY total_points DESC, "userId" ASC) AS INTEGER) AS rank
        FROM user_totals
      )
      SELECT rank
      FROM ranked_users
      WHERE "userId" = ${userId}
      LIMIT 1
    `);

    return rankedUsers[0]?.rank ?? null;
  }

  async getLeaderboard(period: LeaderboardPeriod, limit = 20): Promise<LeaderboardEntry[]> {
    const periodStart = getPeriodStart(period);

    const grouped = await this.prisma.rewardEvent.groupBy({
      by: ['userId'],
      where: periodStart
        ? {
            createdAt: {
              gte: periodStart,
            },
          }
        : undefined,
      _sum: {
        points: true,
      },
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
      take: limit,
    });

    if (grouped.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: grouped.map((entry) => entry.userId),
        },
      },
      select: {
        id: true,
        userId: true,
        username: true,
        fullName: true,
        avatar: true,
      },
    });

    const userById = new Map(users.map((entry) => [entry.id, entry]));

    return grouped
      .map((entry) => {
        const user = userById.get(entry.userId);
        if (!user) {
          return null;
        }

        return {
          userId: entry.userId,
          username: user.username,
          fullName: user.fullName,
          avatar: user.avatar,
          points: entry._sum.points ?? 0,
        } satisfies LeaderboardEntryWithoutRank;
      })
      .filter((entry): entry is LeaderboardEntryWithoutRank => entry !== null)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }
}