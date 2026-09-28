import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import type { Auth0Client, User } from '@auth0/auth0-spa-js';

const {
  mockAuth0ClientInstance,
  mockGetIdTokenClaims,
  mockGetTokenSilently,
  mockIsAuthenticated,
  mockGetUser,
  mockLoginWithPopup,
  mockLogout,
} = vi.hoisted(() => {
  const mockGetIdTokenClaims = vi.fn();
  const mockGetTokenSilently = vi.fn();
  const mockIsAuthenticated = vi.fn();
  const mockGetUser = vi.fn();
  const mockLoginWithPopup = vi.fn();
  const mockLogout = vi.fn();

  const mockAuth0ClientInstance = {
    getIdTokenClaims: mockGetIdTokenClaims,
    getTokenSilently: mockGetTokenSilently,
    isAuthenticated: mockIsAuthenticated,
    getUser: mockGetUser,
    loginWithPopup: mockLoginWithPopup,
    logout: mockLogout,
  } as unknown as Auth0Client;

  return {
    mockAuth0ClientInstance,
    mockGetIdTokenClaims,
    mockGetTokenSilently,
    mockIsAuthenticated,
    mockGetUser,
    mockLoginWithPopup,
    mockLogout,
  };
});

vi.mock('@auth0/auth0-spa-js', () => ({
  createAuth0Client: vi.fn().mockResolvedValue(mockAuth0ClientInstance),
}));

vi.mock('$app/environment', () => ({
  browser: true,
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

vi.mock('$lib/config', () => ({
  config: {
    api: { baseUrl: 'https://api.locful.test' },
    auth0: {
      domain: 'test.auth0.com',
      clientId: 'client-123',
      callbackUrl: 'https://locful.test/callback',
      audience: 'https://api.locful.test',
    },
  },
}));

vi.mock('$lib/rewards', () => ({
  refreshRewardSummary: vi.fn().mockResolvedValue(undefined),
}));

import {
  auth0Client,
  isAuthenticated,
  user,
  getIdToken,
  getAuthHeaders,
  login,
  logout,
  initAuth0,
} from './auth0';

describe('Auth0 authentication module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    auth0Client.set(mockAuth0ClientInstance);
    isAuthenticated.set(false);
    user.set(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getIdToken', () => {
    it('returns null when client is not authenticated', async () => {
      mockIsAuthenticated.mockResolvedValue(false);

      const token = await getIdToken();
      expect(token).toBeNull();
      expect(mockGetIdTokenClaims).not.toHaveBeenCalled();
      expect(mockGetTokenSilently).not.toHaveBeenCalled();
    });

    it('returns cached ID token when token is fresh and far from expiration', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour ahead
      mockGetIdTokenClaims.mockResolvedValue({
        __raw: 'fresh-id-token',
        exp: futureExp,
      });

      const token = await getIdToken();
      expect(token).toBe('fresh-id-token');
      expect(mockGetTokenSilently).not.toHaveBeenCalled();
    });

    it('silently refreshes the token when the cached token is expired', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      const pastExp = Math.floor(Date.now() / 1000) - 100; // expired
      const newExp = Math.floor(Date.now() / 1000) + 3600;

      mockGetIdTokenClaims
        .mockResolvedValueOnce({
          __raw: 'stale-token',
          exp: pastExp,
        })
        .mockResolvedValueOnce({
          __raw: 'renewed-token',
          exp: newExp,
        });

      mockGetTokenSilently.mockResolvedValue('new-access-token');

      const token = await getIdToken();
      expect(mockGetTokenSilently).toHaveBeenCalledTimes(1);
      expect(token).toBe('renewed-token');
    });

    it('silently refreshes the token when it is expiring in under 60 seconds', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      const expiringSoon = Math.floor(Date.now() / 1000) + 30; // 30s remaining (<60s)
      const newExp = Math.floor(Date.now() / 1000) + 3600;

      mockGetIdTokenClaims
        .mockResolvedValueOnce({
          __raw: 'almost-expired-token',
          exp: expiringSoon,
        })
        .mockResolvedValueOnce({
          __raw: 'renewed-token',
          exp: newExp,
        });

      mockGetTokenSilently.mockResolvedValue('new-access-token');

      const token = await getIdToken();
      expect(mockGetTokenSilently).toHaveBeenCalledTimes(1);
      expect(token).toBe('renewed-token');
    });

    it('resets authentication state and returns null when refresh fails with login_required', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      isAuthenticated.set(true);
      user.set({ sub: 'auth0|123', email: 'test@example.com' } as User);

      const pastExp = Math.floor(Date.now() / 1000) - 100;
      mockGetIdTokenClaims.mockResolvedValue({
        __raw: 'stale-token',
        exp: pastExp,
      });

      mockGetTokenSilently.mockRejectedValue({ error: 'login_required' });

      const token = await getIdToken();
      expect(token).toBeNull();
      expect(get(isAuthenticated)).toBe(false);
      expect(get(user)).toBeNull();
    });

    it('returns null gracefully when an unexpected error occurs during silent refresh', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      const pastExp = Math.floor(Date.now() / 1000) - 100;
      mockGetIdTokenClaims.mockResolvedValue({
        __raw: 'stale-token',
        exp: pastExp,
      });

      mockGetTokenSilently.mockRejectedValue(new Error('Network error'));

      const token = await getIdToken();
      expect(token).toBeNull();
    });
  });

  describe('getAuthHeaders', () => {
    it('returns Authorization header with Bearer token when getIdToken resolves', async () => {
      mockIsAuthenticated.mockResolvedValue(true);
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      mockGetIdTokenClaims.mockResolvedValue({
        __raw: 'valid-jwt-token',
        exp: futureExp,
      });

      const headers = await getAuthHeaders();
      expect(headers).toEqual({
        Authorization: 'Bearer valid-jwt-token',
      });
    });

    it('returns an empty object when getIdToken returns null', async () => {
      mockIsAuthenticated.mockResolvedValue(false);

      const headers = await getAuthHeaders();
      expect(headers).toEqual({});
    });
  });

  describe('login and logout flows', () => {
    it('updates user and isAuthenticated stores on successful login', async () => {
      const mockProfile = {
        sub: 'auth0|456',
        name: 'Test User',
        email: 'test@example.com',
      } as User;
      mockLoginWithPopup.mockResolvedValue(undefined);
      mockGetUser.mockResolvedValue(mockProfile);

      // Mock fetch for syncUserToApi
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'OK',
      } as unknown as Response);

      await login();

      expect(mockLoginWithPopup).toHaveBeenCalledTimes(1);
      expect(get(isAuthenticated)).toBe(true);
      expect(get(user)).toEqual(mockProfile);
    });

    it('resets stores on logout', async () => {
      isAuthenticated.set(true);
      user.set({ sub: 'auth0|456' } as User);
      mockLogout.mockResolvedValue(undefined);

      await logout();

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(get(isAuthenticated)).toBe(false);
      expect(get(user)).toBeNull();
    });
  });

  describe('initAuth0', () => {
    it('returns existing client when already initialized', async () => {
      const client = await initAuth0();
      expect(client).toBe(mockAuth0ClientInstance);
    });
  });
});
