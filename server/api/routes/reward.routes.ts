import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { verifyAuth0Token } from '../../middleware/auth';
import type { LeaderboardPeriod } from '../../services/reward.service';
import { RewardService, REWARD_CATALOG } from '../../services/reward.service';
import { leaderboardQuerySchema, LeaderboardQueryParams } from '../schemas/reward.schema';
import { sendErrorResponse } from '../http-errors';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export function normalizeLeaderboardQueryParams(
  query: Partial<Record<'period' | 'limit', unknown>>,
): { period: LeaderboardPeriod; limit: number } {
  const period: LeaderboardPeriod = query.period === 'month' ? 'month' : 'all';

  const rawLimit = query.limit;
  const parsedLimit =
    typeof rawLimit === 'number'
      ? rawLimit
      : typeof rawLimit === 'string'
        ? Number.parseInt(rawLimit, 10)
        : Number.NaN;

  const limit =
    Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100 ? parsedLimit : 20;

  return { period, limit };
}

export async function rewardRoutes(fastify: FastifyInstance) {
  const rewardService = new RewardService(fastify.prisma);

  fastify.get('/catalog', async (_request, reply) => {
    return reply.send({
      rewards: REWARD_CATALOG,
    });
  });

  fastify.get('/me', {
    preHandler: verifyAuth0Token,
    handler: async (request, reply) => {
      if (!request.user?.sub) {
        return sendErrorResponse(reply, 401, 'Unauthorized');
      }

      const user = await fastify.prisma.user.findUnique({
        where: { userId: request.user.sub },
        select: { id: true },
      });

      if (!user) {
        return sendErrorResponse(reply, 404, 'User not found');
      }

      const summary = await rewardService.getUserSummary(user.id);
      return reply.send(summary);
    },
  });

  fastify.get('/leaderboard', {
    schema: {
      querystring: leaderboardQuerySchema,
    },
    handler: async (request, reply) => {
      const { period, limit } = normalizeLeaderboardQueryParams(
        request.query as LeaderboardQueryParams & Partial<Record<'period' | 'limit', unknown>>,
      );
      const leaderboard = await rewardService.getLeaderboard(period, limit);

      return reply.send({
        period,
        limit,
        leaderboard,
      });
    },
  });
}