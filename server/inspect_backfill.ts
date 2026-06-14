import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Users ---');
  const users = await prisma.user.findMany({
    select: {
      userId: true,
      lastLogin: true,
    },
  });
  console.table(users);

  console.log('\n--- DAILY_LOGIN Reward Events ---');
  const rewardEvents = await prisma.rewardEvent.findMany({
    where: {
      action: 'DAILY_LOGIN',
    },
    select: {
      id: true,
      userId: true,
      dedupeKey: true,
      metadata: true,
      createdAt: true,
    },
  });
  
  // Format for display
  const formattedEvents = rewardEvents.map(event => ({
    ...event,
    metadata: JSON.stringify(event.metadata),
    createdAt: event.createdAt.toISOString(),
  }));
  console.table(formattedEvents);

  const backfillEvents = rewardEvents.filter(e => {
    const meta = e.metadata as any;
    return meta && meta.source === 'backfill';
  });
  
  console.log('\n--- Backfill Events ---');
  console.table(backfillEvents.map(event => ({
    ...event,
    metadata: JSON.stringify(event.metadata),
    createdAt: event.createdAt.toISOString(),
  })));

  // Check for today's date in dedupeKey
  const today = new Date().toISOString().split('T')[0];
  const todayBackfill = backfillEvents.filter(e => e.dedupeKey.includes(today));
  
  if (todayBackfill.length > 0) {
    console.log('\nFound backfill events for today:', today);
    console.table(todayBackfill);
  } else {
    console.log('\nNo backfill events found for today:', today);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
