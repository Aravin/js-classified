import { PrismaClient } from '@prisma/client';

export interface DailyStatistics {
  newUsers: number;
  loggedInUsers: number;
  newListings: number;
  activeListings: number;
  date: string;
}

export class StatisticsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get daily statistics for the specified date
   * @param date - Date to get statistics for (defaults to yesterday)
   */
  async getDailyStatistics(date?: Date): Promise<DailyStatistics> {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const startOfDay = new Date(targetDate);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get new users (created today)
    const newUsers = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Get users who logged in today (lastLogin updated today)
    const loggedInUsers = await this.prisma.user.count({
      where: {
        lastLogin: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Get new listings (created today)
    const newListings = await this.prisma.listing.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Get active listings (status = ACTIVE)
    const activeListings = await this.prisma.listing.count({
      where: {
        status: 'ACTIVE',
      },
    });

    return {
      newUsers,
      loggedInUsers,
      newListings,
      activeListings,
      date: targetDate.toISOString().split('T')[0],
    };
  }

  /**
   * Get statistics for yesterday (most common use case for daily reports)
   */
  async getYesterdayStatistics(): Promise<DailyStatistics> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.getDailyStatistics(yesterday);
  }
}

