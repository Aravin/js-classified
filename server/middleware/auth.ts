import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { buildErrorResponseBody } from '../api/http-errors';

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

interface AuthSuccess {
  ok: true;
  token: jwt.JwtPayload;
}

interface AuthFailure {
  ok: false;
  statusCode: number;
  body: ReturnType<typeof buildErrorResponseBody>;
}

export type AuthResult = AuthSuccess | AuthFailure;

function getTokenAudiences(tokenAudience: jwt.JwtPayload['aud']): string[] {
  if (typeof tokenAudience === 'string') {
    return [tokenAudience];
  }

  if (Array.isArray(tokenAudience)) {
    return tokenAudience.filter((audience): audience is string => typeof audience === 'string');
  }

  return [];
}

type TokenType = 'access_token' | 'id_token';

/**
 * Classify a token as an access token or ID token.
 *
 * Resolution order (stops at first match):
 *  1. Explicit: aud contains AUTH0_AUDIENCE  → access token
 *  2. Explicit: aud contains AUTH0_CLIENT_ID → ID token
 *  3. Heuristic fallback: URL-shaped audience → access token, otherwise ID token
 *
 * The heuristic-only approach misclassifies non-URL API audiences such as
 * `api://...` as ID tokens; explicit matching is always preferred.
 */
function classifyToken(
  tokenAudience: jwt.JwtPayload['aud'],
  auth0Audience?: string,
  auth0ClientId?: string,
): TokenType {
  const audiences = getTokenAudiences(tokenAudience);

  if (auth0Audience && audiences.includes(auth0Audience)) {
    return 'access_token';
  }
  if (auth0ClientId && audiences.includes(auth0ClientId)) {
    return 'id_token';
  }

  // Heuristic fallback for unconfigured or unmatched audiences
  const hasUrlAudience = audiences.some((aud) => aud.startsWith('http'));
  return hasUrlAudience ? 'access_token' : 'id_token';
}

export async function authenticateAuth0Token(request: FastifyRequest): Promise<AuthResult> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      statusCode: 401,
      body: buildErrorResponseBody('Missing Authorization header'),
    };
  }

  const token = authHeader.substring(7);
  const tokenParts = token.split('.');

  if (tokenParts.length === 5) {
    return {
      ok: false,
      statusCode: 401,
      body: buildErrorResponseBody(
        'Opaque token received',
        'User needs to grant API access. Please login again and authorize the API.',
      ),
    };
  }

  if (tokenParts.length !== 3) {
    return {
      ok: false,
      statusCode: 401,
      body: buildErrorResponseBody('Invalid token format'),
    };
  }

  const auth0Domain = process.env.AUTH0_DOMAIN;
  const auth0Audience = process.env.AUTH0_AUDIENCE?.trim();
  const auth0ClientId = process.env.AUTH0_CLIENT_ID?.trim();

  if (!auth0Domain) {
    return {
      ok: false,
      statusCode: 500,
      body: buildErrorResponseBody('Auth0 configuration missing: AUTH0_DOMAIN'),
    };
  }

  try {
    const decoded = jwt.decode(token, {
      complete: true,
    }) as { header?: jwt.JwtHeader; payload?: jwt.JwtPayload } | null;

    if (!decoded || !decoded.payload) {
      return {
        ok: false,
        statusCode: 401,
        body: buildErrorResponseBody('Invalid token format'),
      };
    }

  const tokenAudience = decoded.payload.aud;
  const audiences = getTokenAudiences(tokenAudience);
  const tokenType = classifyToken(tokenAudience, auth0Audience, auth0ClientId);

    let expectedAudience: string | undefined;

    if (tokenType === 'id_token') {
      if (!auth0ClientId) {
        return {
          ok: false,
          statusCode: 500,
          body: buildErrorResponseBody(
            'Auth0 configuration missing',
            'AUTH0_CLIENT_ID is required for ID token validation',
          ),
        };
      }

      if (!audiences.includes(auth0ClientId)) {
        return {
          ok: false,
          statusCode: 401,
          body: buildErrorResponseBody(
            'Invalid token audience',
            'Token audience does not match configured client ID',
          ),
        };
      }

      expectedAudience = auth0ClientId;
    } else {
      if (!auth0Audience) {
        return {
          ok: false,
          statusCode: 500,
          body: buildErrorResponseBody(
            'Auth0 configuration missing',
            'AUTH0_AUDIENCE is required for access token validation',
          ),
        };
      }

      if (!audiences.includes(auth0Audience)) {
        return {
          ok: false,
          statusCode: 401,
          body: buildErrorResponseBody(
            'Invalid token audience',
            'Token audience does not match configured API audience',
          ),
        };
      }

      expectedAudience = auth0Audience;
    }

    const verifiedToken = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: expectedAudience,
          issuer: `https://${auth0Domain}/`,
          algorithms: ['RS256'],
        },
        (err, verified) => {
          if (err) reject(err);
          else resolve(verified as jwt.JwtPayload);
        },
      );
    });

    if (verifiedToken.exp && verifiedToken.exp < Date.now() / 1000) {
      return {
        ok: false,
        statusCode: 401,
        body: buildErrorResponseBody('Token expired'),
      };
    }

    return {
      ok: true,
      token: verifiedToken,
    };
  } catch (error: any) {
    request.log.warn({ err: error }, 'JWT verification failed');
    return {
      ok: false,
      statusCode: 401,
      body: buildErrorResponseBody('Invalid or expired token'),
    };
  }
}

/**
 * Fastify pre-handler wrapper for Auth0 JWT validation.
 * Sends an error response on failure and attaches request.user on success.
 */
export async function verifyAuth0Token(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const result = await authenticateAuth0Token(request);

  if (!result.ok) {
    reply.code(result.statusCode).send(result.body);
    return;
  }

  request.user = result.token;
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
    const result = await authenticateAuth0Token(request);
    if (result.ok) {
      request.user = result.token;
    } else {
      // A present but invalid token is an explicit auth failure — return 401
      // so callers can detect expired/malformed credentials rather than
      // silently receiving a public (masked) response.
      reply.code(result.statusCode).send(result.body);
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
    reply.code(401).send(buildErrorResponseBody('Authentication required'));
    return false;
  }

  const userId = request.user.sub;
  
  // Convert to string for comparison
  const ownerIdStr = String(resourceOwnerId);
  const userIdStr = String(userId);

  if (ownerIdStr !== userIdStr) {
    reply.code(403).send(buildErrorResponseBody('Access denied. You do not own this resource.'));
    return false;
  }

  return true;
}


