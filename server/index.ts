import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { configureSecurityPlugins } from './plugins/security';
import { listingRoutes } from './api/routes/listing.routes';
import { imageRoutes } from './api/routes/image.routes';
import { userRoutes } from './api/routes/user.routes';
import { validateInputMiddleware, securityErrorHandler } from './middleware/security';
import { config, validateEnvConfig } from './config/config';
import { validateSecurityConfig } from './config/security';
import { StatisticsService } from './services/statistics.service';
import { EmailService } from './services/email.service';

// Validate environment variables before starting
validateEnvConfig();

// A02 - Cryptographic Failures: Validate security configuration
validateSecurityConfig();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const server = fastify({
  logger: true,
});

// Initialize Prisma
const prisma = new PrismaClient();

// Decorate fastify with prisma
server.decorate('prisma', prisma);

// Add close hook to disconnect Prisma
server.addHook('onClose', async (instance) => {
  await instance.prisma.$disconnect();
});

// Configure security plugins (OWASP A01-A10)
server.register(configureSecurityPlugins);

// A03 - Injection: Add input validation middleware
server.addHook('onRequest', validateInputMiddleware);

// A09 - Security Logging: Add error handler
server.setErrorHandler((error, request, reply) => {
  securityErrorHandler(error, request, reply);
});

// Register routes with /api prefix (for backward compatibility)
server.register(listingRoutes, { prefix: '/api/listings' });
server.register(imageRoutes, { prefix: '/api/images' });
server.register(userRoutes, { prefix: '/api/users' });

// Register routes without /api prefix (for api.locful.com domain)
server.register(listingRoutes, { prefix: '/listings' });
server.register(imageRoutes, { prefix: '/images' });
server.register(userRoutes, { prefix: '/users' });

// Initialize services for cron jobs
const statisticsService = new StatisticsService(prisma);
let emailService: EmailService | null = null;

// Setup email service if enabled
if (config.email.enabled) {
  const isSMTP = config.email.provider === 'smtp';
  const isSendGrid = config.email.provider === 'sendgrid';

  // Validate configuration based on provider
  if (!config.email.from || !config.email.to) {
    console.warn('⚠️  Email is enabled but missing required configuration (EMAIL_FROM or EMAIL_TO). Daily reports will be disabled.');
  } else if (isSMTP && (!config.email.user || !config.email.password)) {
    console.warn('⚠️  SMTP email is enabled but missing required configuration (EMAIL_USER or EMAIL_PASSWORD). Daily reports will be disabled.');
  } else if (isSendGrid && !config.email.sendgridApiKey) {
    console.warn('⚠️  SendGrid email is enabled but missing required configuration (SENDGRID_API_KEY). Daily reports will be disabled.');
  } else {
    if (isSMTP) {
      emailService = new EmailService({
        provider: 'smtp',
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
        from: config.email.from,
        to: config.email.to,
      });
      console.log('📧 Email service configured: SMTP');
    } else if (isSendGrid) {
      emailService = new EmailService({
        provider: 'sendgrid',
        apiKey: config.email.sendgridApiKey,
        from: config.email.from,
        to: config.email.to,
      });
      console.log('📧 Email service configured: SendGrid');
    }

    // Verify email connection on startup
    if (emailService) {
      emailService.verifyConnection().catch((error) => {
        console.error('⚠️  Email service verification failed:', error);
      });
    }
  }
}

// Setup daily statistics report cron job
if (config.cron.dailyReportEnabled) {
  if (!config.cron.jobSecret) {
    console.warn('⚠️  CRON_DAILY_REPORT_ENABLED is true but CRON_JOB_SECRET is not set. Requests from Cloud Scheduler will be rejected.');
  }

  if (!emailService) {
    console.warn('⚠️  Daily report cron job is enabled but email service is not configured.');
  }

  server.register(async (fastify) => {
    fastify.post('/internal/cron/daily-statistics', async (request, reply) => {
      if (!config.cron.dailyReportEnabled) {
        return reply.code(503).send({
          status: 'disabled',
          message: 'Daily statistics email is disabled.',
        });
      }

      if (!emailService) {
        request.log.error('Daily statistics endpoint invoked but email service is not configured.');
        return reply.code(503).send({
          status: 'error',
          message: 'Email service is not configured.',
        });
      }

      const headerSecret = request.headers['x-cron-secret'];
      const providedSecret = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret;

      if (!config.cron.jobSecret || providedSecret !== config.cron.jobSecret) {
        request.log.warn('Unauthorized cron invocation attempt.');
        return reply.code(401).send({
          status: 'unauthorized',
          message: 'Invalid cron secret.',
        });
      }

      try {
        request.log.info('Processing daily statistics cron request.');
        const stats = await statisticsService.getYesterdayStatistics();
        await emailService.sendDailyStatisticsReport(stats);
        return reply.code(200).send({
          status: 'ok',
          message: 'Daily statistics report sent.',
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to send daily statistics report.');
        return reply.code(500).send({
          status: 'error',
          message: 'Failed to send daily statistics report.',
        });
      }
    });
  });

  console.log('🌐 Daily statistics report endpoint ready at POST /internal/cron/daily-statistics');
  console.log('   ➜ Trigger this endpoint from Cloud Scheduler using header X-Cron-Secret');
  console.log(`   ➜ Suggested schedule (UTC): ${config.cron.dailyReportTime}`);
} else {
  console.log('ℹ️  Daily statistics report cron job is disabled.');
}

// Health check route with connection checks
server.get('/health', async (request, reply) => {
  const { checks: checksParam } = request.query as { checks?: string };

  // Default: just return OK with timestamp
  if (checksParam !== 'true') {
    return reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  // If checks=true, do all connection checks
  const checks: Record<string, { status: string; message?: string }> = {};
  let overallStatus = 'ok';

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', message: 'Database connection successful' };
  } catch (error) {
    checks.database = { status: 'error', message: `Database connection failed: ${(error as Error).message}` };
    overallStatus = 'error';
  }

  // Check Cloudinary configuration
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (cloudName && apiKey && apiSecret) {
      checks.cloudinary = { status: 'ok', message: 'Cloudinary configured' };
    } else {
      checks.cloudinary = { status: 'error', message: 'Cloudinary not configured' };
      overallStatus = 'error';
    }
  } catch (error) {
    checks.cloudinary = { status: 'error', message: `Cloudinary check failed: ${(error as Error).message}` };
    overallStatus = 'error';
  }

  const statusCode = overallStatus === 'ok' ? 200 : 503;
  return reply.code(statusCode).send({
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
  });
});

const start = async () => {
  try {
    const address = await server.listen({
      port: config.server.port,
      host: config.server.host,
    });
    console.log(`✅ Server listening at ${address}`);
    console.log(`📡 Health check available at ${address}/health`);
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    server.log.error(err);
    process.exit(1);
  }
};

start();
