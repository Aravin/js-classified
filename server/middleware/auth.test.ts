import type { FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload, SigningKeyCallback, VerifyOptions } from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const decodeMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());
const getSigningKeyMock = vi.hoisted(() => vi.fn());

vi.mock('jsonwebtoken', () => ({
  default: {
    decode: decodeMock,
    verify: verifyMock,
  },
}));

vi.mock('jwks-rsa', () => ({
  default: vi.fn(() => ({
    getSigningKey: getSigningKeyMock,
  })),
}));

import { optionalAuth, verifyAuth0Token } from './auth';

interface ReplyStub {
  code: (statusCode: number) => ReplyStub;
  send: (body: unknown) => ReplyStub;
  statusCode?: number;
  body?: unknown;
}

function createReply(): FastifyReply & ReplyStub {
  const reply: ReplyStub = {
    statusCode: undefined,
    body: undefined,
    code: vi.fn(function (statusCode: number) {
      reply.statusCode = statusCode;
      return reply;
    }) as unknown as ReplyStub['code'],
    send: vi.fn(function (body: unknown) {
      reply.body = body;
      return reply;
    }) as unknown as ReplyStub['send'],
  };

  return reply as FastifyReply & ReplyStub;
}

function createRequest(authorization?: string): FastifyRequest {
  return {
    headers: authorization ? { authorization } : {},
    log: {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as FastifyRequest;
}

function mockDecodedAudience(aud: JwtPayload['aud']) {
  decodeMock.mockReturnValue({
    header: { kid: 'kid-123' },
    payload: { aud },
  });
}

function mockVerifiedToken(overrides: Partial<JwtPayload> = {}) {
  verifyMock.mockImplementation(
    (
      _token: string,
      _getKey: (header: unknown, callback: SigningKeyCallback) => void,
      _options: VerifyOptions,
      callback: (error: Error | null, verified?: JwtPayload) => void,
    ) => {
      callback(null, {
        sub: 'auth0|user',
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...overrides,
      });
    },
  );
}

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.AUTH0_DOMAIN = 'tenant.example.com';
  process.env.AUTH0_AUDIENCE = 'https://api.locful.test';
  process.env.AUTH0_CLIENT_ID = 'client-123';
  decodeMock.mockReset();
  verifyMock.mockReset();
  getSigningKeyMock.mockReset();
});

afterEach(() => {
  process.env.AUTH0_DOMAIN = originalEnv.AUTH0_DOMAIN;
  process.env.AUTH0_AUDIENCE = originalEnv.AUTH0_AUDIENCE;
  process.env.AUTH0_CLIENT_ID = originalEnv.AUTH0_CLIENT_ID;
});

describe('verifyAuth0Token', () => {
  it('returns a standardized 401 when the authorization header is missing', async () => {
    const request = createRequest();
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({
      error: 'Missing Authorization header',
      message: 'Missing Authorization header',
    });
    expect(decodeMock).not.toHaveBeenCalled();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('rejects opaque tokens with a 5-part bearer token payload', async () => {
    const request = createRequest('Bearer a.b.c.d.e');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({
      error: 'Opaque token received',
      message: 'Opaque token received',
      details: 'User needs to grant API access. Please login again and authorize the API.',
    });
    expect(decodeMock).not.toHaveBeenCalled();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('rejects bearer tokens with an invalid JWT part count', async () => {
    const request = createRequest('Bearer a.b');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({
      error: 'Invalid token format',
      message: 'Invalid token format',
    });
    expect(decodeMock).not.toHaveBeenCalled();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('validates an ID token when aud is a string matching AUTH0_CLIENT_ID', async () => {
    mockDecodedAudience('client-123');
    mockVerifiedToken();
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(request.user).toMatchObject({ sub: 'auth0|user' });
    expect(verifyMock).toHaveBeenCalledWith(
      'a.b.c',
      expect.any(Function),
      expect.objectContaining({
        audience: 'client-123',
        issuer: 'https://tenant.example.com/',
        algorithms: ['RS256'],
      }),
      expect.any(Function),
    );
  });

  it('rejects an ID token when aud is a string that does not match AUTH0_CLIENT_ID', async () => {
    mockDecodedAudience('wrong-client');
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({
      error: 'Invalid token audience',
      message: 'Invalid token audience',
      details: 'Token audience does not match configured client ID',
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('validates an access token when aud is a string matching AUTH0_AUDIENCE', async () => {
    mockDecodedAudience('https://api.locful.test');
    mockVerifiedToken();
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(request.user).toMatchObject({ sub: 'auth0|user' });
    expect(verifyMock).toHaveBeenCalledWith(
      'a.b.c',
      expect.any(Function),
      expect.objectContaining({ audience: 'https://api.locful.test' }),
      expect.any(Function),
    );
  });

  it('rejects an access token when aud is a string that does not match AUTH0_AUDIENCE', async () => {
    mockDecodedAudience('https://other-api.test');
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({
      error: 'Invalid token audience',
      message: 'Invalid token audience',
      details: 'Token audience does not match configured API audience',
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('treats aud arrays without the API audience as ID tokens and validates AUTH0_CLIENT_ID', async () => {
    mockDecodedAudience(['client-123', 'account']);
    mockVerifiedToken();
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(verifyMock).toHaveBeenCalledWith(
      'a.b.c',
      expect.any(Function),
      expect.objectContaining({ audience: 'client-123' }),
      expect.any(Function),
    );
  });

  it('treats aud arrays containing the API audience as access tokens and validates AUTH0_AUDIENCE', async () => {
    mockDecodedAudience(['https://api.locful.test', 'https://tenant.example.com/userinfo']);
    mockVerifiedToken();
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(verifyMock).toHaveBeenCalledWith(
      'a.b.c',
      expect.any(Function),
      expect.objectContaining({ audience: 'https://api.locful.test' }),
      expect.any(Function),
    );
  });

  it('treats a non-URL audience that matches AUTH0_AUDIENCE as an access token, not an ID token', async () => {
    process.env.AUTH0_AUDIENCE = 'api://my-custom-audience';
    mockDecodedAudience('api://my-custom-audience');
    mockVerifiedToken();
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(request.user).toMatchObject({ sub: 'auth0|user' });
    expect(verifyMock).toHaveBeenCalledWith(
      'a.b.c',
      expect.any(Function),
      expect.objectContaining({ audience: 'api://my-custom-audience' }),
      expect.any(Function),
    );
  });

  it('treats a non-URL audience array matching AUTH0_AUDIENCE as an access token', async () => {
    process.env.AUTH0_AUDIENCE = 'api://my-custom-audience';
    mockDecodedAudience(['api://my-custom-audience', 'openid']);
    mockVerifiedToken();
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(request.user).toMatchObject({ sub: 'auth0|user' });
    expect(verifyMock).toHaveBeenCalledWith(
      'a.b.c',
      expect.any(Function),
      expect.objectContaining({ audience: 'api://my-custom-audience' }),
      expect.any(Function),
    );
  });

  it('prefers AUTH0_AUDIENCE over AUTH0_CLIENT_ID when aud array contains both', async () => {
    mockDecodedAudience(['https://api.locful.test', 'client-123']);
    mockVerifiedToken();
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(request.user).toMatchObject({ sub: 'auth0|user' });
    expect(verifyMock).toHaveBeenCalledWith(
      'a.b.c',
      expect.any(Function),
      expect.objectContaining({ audience: 'https://api.locful.test' }),
      expect.any(Function),
    );
  });

  it('rejects a token with an empty aud array with a 401', async () => {
    mockDecodedAudience([]);
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({
      error: 'Invalid token audience',
      message: 'Invalid token audience',
      details: 'Token audience does not match configured client ID',
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('returns a 500 when AUTH0_AUDIENCE is not configured and the token aud is URL-shaped', async () => {
    delete process.env.AUTH0_AUDIENCE;
    mockDecodedAudience('https://some-api.test');
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(reply.statusCode).toBe(500);
    expect(reply.body).toEqual({
      error: 'Auth0 configuration missing',
      message: 'Auth0 configuration missing',
      details: 'AUTH0_AUDIENCE is required for access token validation',
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('logs the internal error and returns a fixed 401 message when jwt.verify rejects', async () => {
    mockDecodedAudience('https://api.locful.test');
    verifyMock.mockImplementation(
      (
        _token: string,
        _getKey: unknown,
        _options: unknown,
        callback: (error: Error | null) => void,
      ) => {
        callback(new Error('invalid signature'));
      },
    );
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({
      error: 'Invalid or expired token',
      message: 'Invalid or expired token',
    });
    expect((request.log.warn as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.objectContaining({ message: 'invalid signature' }) }),
      'JWT verification failed',
    );
  });

  it('returns a standardized 401 when the verified token is already expired', async () => {
    mockDecodedAudience('https://api.locful.test');
    mockVerifiedToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    const request = createRequest('Bearer a.b.c');
    const reply = createReply();

    await verifyAuth0Token(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body).toEqual({
      error: 'Token expired',
      message: 'Token expired',
    });
    expect(request.user).toBeUndefined();
  });
});

describe('optionalAuth', () => {
  it('returns 401 when a bearer token is present but fails validation', async () => {
    const request = createRequest('Bearer a.b');
    const reply = createReply();

    await optionalAuth(request, reply);

    expect(reply.statusCode).toBe(401);
    expect(request.user).toBeUndefined();
  });

  it('passes through without setting a response when no authorization header is present', async () => {
    const request = createRequest();
    const reply = createReply();

    await optionalAuth(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });
});