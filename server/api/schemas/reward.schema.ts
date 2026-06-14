export const leaderboardQuerySchema = {
  type: 'object',
  properties: {
    period: {
      type: 'string',
      enum: ['all', 'month'],
      default: 'all',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20,
    },
  },
};

export interface LeaderboardQueryParams {
  period?: 'all' | 'month';
  limit?: number;
}