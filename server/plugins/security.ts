import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

/**
 * OWASP Top 10 Security Implementation
 * A01-A10: Comprehensive security hardening
 */

// A05 - Security Misconfiguration: CORS configuration
const CORS_ORIGINS = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'https://locful.com', 'https://www.locful.com'];

export async function configureSecurityPlugins(fastify: FastifyInstance) {
  // A05 - Security Misconfiguration: Secure headers via Helmet
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Required for some UI frameworks
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'], // Allow images from any HTTPS source
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable if you serve assets from CDN
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  });

  // A05 - Security Misconfiguration: Secure CORS
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (CORS_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        // In production, be strict; in development, log warning
        if (process.env.NODE_ENV === 'production') {
          callback(new Error('Not allowed by CORS'), false);
        } else {
          console.warn(`⚠️  CORS: Origin ${origin} not in allowed list, but allowing in dev mode`);
          callback(null, true);
        }
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  // A04 - Insecure Design: Rate Limiting
  await fastify.register(rateLimit, {
    max: 100, // Maximum 100 requests
    timeWindow: '1 minute', // Per 1 minute
    cache: 10000, // Cache size
    whitelist: ['127.0.0.1', '::1'], // Whitelist localhost in dev
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.round(context.ttl / 1000),
      };
    },
  });

  // A09 - Security Logging and Monitoring Failures: Security event logging
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Log security-relevant events
    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };

    Object.entries(securityHeaders).forEach(([key, value]) => {
      reply.header(key, value);
    });

    // Log suspicious requests
    const userAgent = request.headers['user-agent'] || '';
    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /\.\./, // Path traversal attempts
      /<script/i, // XSS attempts
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(request.url) || pattern.test(userAgent))) {
      fastify.log.warn({
        type: 'SECURITY_ALERT',
        message: 'Suspicious request detected',
        ip: request.ip,
        url: request.url,
        userAgent,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // A03 - Injection: Request size limits and validation
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    const maxSize = 1024 * 1024; // 1MB
    if (body.length > maxSize) {
      done(new Error('Request body too large'), undefined);
    } else {
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  });
}
