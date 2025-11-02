# OWASP Top 10 Security Implementation

This document outlines the security measures implemented to address OWASP Top 10 vulnerabilities.

## A01:2021 – Broken Access Control ✅

**Implemented:**
- Authentication middleware (`middleware/auth.ts`)
- JWT token validation with Auth0
- Resource ownership verification (`requireOwnership`)
- Optional authentication for public endpoints
- Authorization checks on protected routes

**Usage:**
```typescript
// Require authentication
fastify.get('/protected', {
  preHandler: verifyAuth0Token
}, async (request, reply) => {
  // User is authenticated
});

// Check ownership
if (!await requireOwnership(request, reply, listing.userId)) {
  return; // Already sent 403 response
}
```

## A02:2021 – Cryptographic Failures ✅

**Implemented:**
- HTTPS enforcement in production (`config/security.ts`)
- Secure secrets management via environment variables
- Secret complexity validation
- File upload security with MIME type validation
- Secure session configuration

**Configuration:**
- All secrets stored in environment variables (GCP Secret Manager in production)
- HTTPS required in production
- Strong password requirements (when user accounts are added)

## A03:2021 – Injection ✅

**Implemented:**
- Input validation with Zod schemas (`middleware/validation.ts`)
- SQL injection protection via Prisma parameterized queries
- XSS protection via string sanitization
- Request body size limits
- File upload validation

**Usage:**
```typescript
import { validateBody, validateQuery, sanitizeString } from '../middleware/validation';

const body = validateBody(request, createListingSchema);
const query = validateQuery(request, listingQuerySchema);
const safe = sanitizeString(userInput);
```

## A04:2021 – Insecure Design ✅

**Implemented:**
- Rate limiting (100 requests/minute) (`plugins/security.ts`)
- Request size limits (1MB for JSON)
- Security-by-design patterns
- Request timeout handling

**Configuration:**
- Rate limit: 100 requests per minute per IP
- Request body size: 1MB max
- Timeout: 120 seconds for file uploads

## A05:2021 – Security Misconfiguration ✅

**Implemented:**
- Security headers via Helmet (`plugins/security.ts`)
- Secure CORS configuration (whitelist-based)
- CSP (Content Security Policy)
- HSTS (HTTP Strict Transport Security)
- Security headers on all responses

**Headers Set:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

## A06:2021 – Vulnerable and Outdated Components ⚠️

**Recommendations:**
- Run `npm audit` regularly
- Keep dependencies updated
- Monitor security advisories
- Consider using Snyk or Dependabot

**Current Status:**
- All packages up to date
- No known vulnerabilities in dependencies
- Regular audits recommended

## A07:2021 – Identification and Authentication Failures ✅

**Implemented:**
- Auth0 integration for authentication
- JWT token validation with expiration checks
- Token format validation (3-part JWT only)
- Secure session management
- Authentication failure logging

**Features:**
- Token expiration validation
- Opaque token detection
- Authentication event logging
- Proper error handling for auth failures

## A08:2021 – Software and Data Integrity Failures ✅

**Implemented:**
- Request integrity validation (`middleware/security.ts`)
- Content-Type validation
- Secure dependency management
- Input sanitization

**Validation:**
- Content-Type matches request body
- JSON-only endpoints reject non-JSON requests
- Request signature validation (can be extended)

## A09:2021 – Security Logging and Monitoring Failures ✅

**Implemented:**
- Security event logging (`middleware/security.ts`)
- Structured logging format
- Suspicious activity detection
- Authentication event tracking
- Error logging with security context

**Logged Events:**
- Authentication attempts (success/failure)
- Authorization denials
- Rate limit exceeded
- Suspicious patterns detected
- Security errors

**Usage:**
```typescript
import { logSecurityEvent } from '../middleware/security';

logSecurityEvent(request, {
  type: 'AUTH_FAILURE',
  message: 'Invalid token',
  user: request.user?.sub,
});
```

## A10:2021 – Server-Side Request Forgery (SSRF) ✅

**Implemented:**
- URL validation function (`middleware/validation.ts`)
- Internal network blocking
- Protocol validation (HTTP/HTTPS only)
- Domain whitelist support

**Usage:**
```typescript
import { validateUrl } from '../middleware/validation';

try {
  const url = validateUrl(userInput, ['allowed-domain.com']);
  // URL is safe to use
} catch (error) {
  // Handle invalid/unsafe URL
}
```

**Protections:**
- Blocks private/internal IPs (localhost, 192.168.x.x, 10.x.x.x, etc.)
- Only allows HTTP/HTTPS protocols
- Optional domain whitelist
- Prevents path traversal

## Environment Variables

Required security-related environment variables:

```bash
# Authentication
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=https://api.locful.com

# CORS
CORS_ORIGINS=https://locful.com,https://www.locful.com

# Secrets (stored in GCP Secret Manager)
DATABASE_URL=...
CLOUDINARY_API_SECRET=...

# Security
NODE_ENV=production
PROTOCOL=https
```

## Best Practices

1. **Never log sensitive data** (passwords, tokens, API keys)
2. **Always validate user input** before processing
3. **Use parameterized queries** (Prisma handles this)
4. **Keep dependencies updated** (`npm audit`)
5. **Monitor security logs** for suspicious activity
6. **Use HTTPS** in production
7. **Store secrets securely** (environment variables/secret manager)
8. **Implement proper error handling** without exposing internals

## Security Testing

Recommended tests:
- [ ] Penetration testing
- [ ] Dependency scanning (`npm audit`)
- [ ] Security headers validation
- [ ] Rate limiting verification
- [ ] Input validation testing
- [ ] Authentication flow testing
- [ ] SSRF protection testing

## Incident Response

In case of security incident:
1. Review security logs immediately
2. Identify affected systems/data
3. Block malicious IPs if needed
4. Rotate secrets if compromised
5. Document incident and remediation steps


