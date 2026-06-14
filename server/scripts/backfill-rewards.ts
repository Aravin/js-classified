// Canonical sources for point values and helpers:
//   - REWARD_POINTS, isProfileComplete → services/reward.service.ts
//   - startOfUtcDay                    → utils/date-buckets.ts
// Run with: npx ts-node scripts/backfill-rewards.ts

import { PrismaClient, RewardAction, Prisma } from '@prisma/client';
import { REWARD_POINTS, isProfileComplete } from '../services/reward.service';
import { startOfUtcDay } from '../utils/date-buckets';

const prisma = new PrismaClient();

async function grantRewardIfMissing(
  tx: Prisma.TransactionClient,
  input: {
    userId: number;
    action: RewardAction;
    points: number;
    dedupeKey: string;
    sourceType?: string;
    sourceId?: number;
    metadata?: Prisma.InputJsonValue;
    createdAt?: Date;
  },
): Promise<boolean> {
  const existing = await tx.rewardEvent.findUnique({
    where: { dedupeKey: input.dedupeKey },
  });

  if (existing) {
    return false;
  }

  await tx.rewardEvent.create({
    data: input,
  });

  await tx.user.update({
    where: { id: input.userId },
    data: {
      rewardPoints: {
        increment: input.points,
      },
    },
  });

  return true;
}

async function main() {
  const users = await prisma.user.findMany({
    include: {
      listings: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          republishCount: true,
          republishedAt: true,
        },
      },
    },
  });

  let createdCount = 0;

  for (const user of users) {
    await prisma.$transaction(async (tx) => {
      if (user.lastLogin) {
        const loginDay = startOfUtcDay(user.lastLogin);
        const loginDayKey = loginDay.toISOString().slice(0, 10);
        const created = await grantRewardIfMissing(tx, {
          userId: user.id,
          action: RewardAction.DAILY_LOGIN,
          points: REWARD_POINTS[RewardAction.DAILY_LOGIN],
          dedupeKey: `login:${user.userId}:${loginDayKey}`,
          metadata: { source: 'backfill', date: loginDayKey },
          createdAt: user.lastLogin,
        });
        if (created) createdCount += 1;
      }

      if (isProfileComplete(user)) {
        const created = await grantRewardIfMissing(tx, {
          userId: user.id,
          action: RewardAction.PROFILE_COMPLETED,
          points: REWARD_POINTS[RewardAction.PROFILE_COMPLETED],
          dedupeKey: `profile-complete:${user.id}`,
          metadata: { source: 'backfill' },
        });
        if (created) createdCount += 1;
      }

      for (const listing of user.listings) {
        if (listing.status !== 'DRAFT' && listing.status !== 'DELETED') {
          const created = await grantRewardIfMissing(tx, {
            userId: user.id,
            action: RewardAction.LISTING_PUBLISHED,
            points: REWARD_POINTS[RewardAction.LISTING_PUBLISHED],
            dedupeKey: `publish:${listing.id}`,
            sourceType: 'listing',
            sourceId: listing.id,
            metadata: { source: 'backfill' },
            createdAt: listing.createdAt,
          });
          if (created) createdCount += 1;
        }

        for (let index = 1; index <= (listing.republishCount || 0); index += 1) {
          const created = await grantRewardIfMissing(tx, {
            userId: user.id,
            action: RewardAction.LISTING_REPUBLISHED,
            points: REWARD_POINTS[RewardAction.LISTING_REPUBLISHED],
            dedupeKey: `republish:${listing.id}:${index}`,
            sourceType: 'listing',
            sourceId: listing.id,
            metadata: { source: 'backfill', republishCount: index },
            createdAt: listing.republishedAt ?? listing.createdAt,
          });
          if (created) createdCount += 1;
        }
      }
    });
  }

  console.log(`Backfill complete. Created ${createdCount} reward events.`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
