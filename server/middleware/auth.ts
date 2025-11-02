import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

/**
 * A01 - Broken Access Control: Authentication middleware
 * A07 - Authentication Failures: JWT validation
 */

// Create JWKS client
const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid || '', (err, key) => {
    if (err) return callback(err);
    callback(null, key?.getPublicKey());
  });
}

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: jwt.JwtPayload;
  }
}

/**
 * Verify Auth0 JWT token from Authorization header
 * Returns true if valid, false otherwise (sends 401 response)
 */
export async function verifyAuth0Token(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing Authorization header' });
    return false;
  }

  const token = authHeader.substring(7);
  const tokenParts = token.split('.');

  // Check if opaque token (5 parts) - need user to grant API access
  if (tokenParts.length === 5) {
    reply.code(401).send({ 
      error: 'Opaque token received', 
      details: 'User needs to grant API access. Please login again and authorize the API.' 
    });
    return false;
  }

  // Must be JWT (3 parts)
  if (tokenParts.length !== 3) {
    reply.code(401).send({ error: 'Invalid token format' });
    return false;
  }

  const auth0Domain = process.env.AUTH0_DOMAIN;
  const auth0Audience = process.env.AUTH0_AUDIENCE;

  if (!auth0Domain || !auth0Audience) {
    reply.code(500).send({ error: 'Auth0 configuration missing' });
    return false;
  }

  try {
    const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: auth0Audience,
          issuer: `https://${auth0Domain}/`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded as jwt.JwtPayload);
        }
      );
    });

    // A07 - Authentication Failures: Verify token hasn't expired
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      reply.code(401).send({ error: 'Token expired' });
      return false;
    }

    // Attach user to request
    request.user = decoded;
    return true;
  } catch (error: any) {
    const errorMessage = error?.message || 'Invalid or expired token';
    reply.code(401).send({ error: errorMessage });
    return false;
  }
}

/**
 * A01 - Broken Access Control: Optional authentication
 * Checks if user is authenticated, but doesn't require it
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // Try to verify, but don't fail if invalid
    try {
      await verifyAuth0Token(request, reply);
    } catch {
      // Ignore errors for optional auth
    }
  }
}

/**
 * A01 - Broken Access Control: Check resource ownership
 */
export async function requireOwnership(
  request: FastifyRequest,
  reply: FastifyReply,
  resourceOwnerId: string | number
): Promise<boolean> {
  if (!request.user) {
    reply.code(401).send({ error: 'Authentication required' });
    return false;
  }

  const userId = request.user.sub;
  
  // Convert to string for comparison
  const ownerIdStr = String(resourceOwnerId);
  const userIdStr = String(userId);

  if (ownerIdStr !== userIdStr) {
    reply.code(403).send({ error: 'Access denied. You do not own this resource.' });
    return false;
  }

  return true;
}

