import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkActiveAdsLimit, isListingExpired, getExpiryDate } from './utils';
import { config } from './config';

// Mock getAuthHeaders
vi.mock('./auth/auth0', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
}));

describe('checkActiveAdsLimit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should use the user-level limit override (listingLimit) when provided', async () => {
    const mockListingsResponse = {
      listings: [
        { id: 1, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 2, status: 'ACTIVE', createdAt: new Date().toISOString() },
      ],
      total: 2,
      listingLimit: 3,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockListingsResponse,
    } as Response);

    // activeCount (2) < userLimit override (3), so hasReachedLimit should be false
    const result = await checkActiveAdsLimit('user-1');
    expect(result.hasReachedLimit).toBe(false);
    expect(result.activeCount).toBe(2);
    expect(result.activeLimit).toBe(3);
  });

  it('should trigger limit when active ads equal or exceed the user-level limit override', async () => {
    const mockListingsResponse = {
      listings: [
        { id: 1, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 2, status: 'ACTIVE', createdAt: new Date().toISOString() },
      ],
      total: 2,
      listingLimit: 2,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockListingsResponse,
    } as Response);

    // activeCount (2) >= userLimit override (2), so hasReachedLimit should be true
    const result = await checkActiveAdsLimit('user-1');
    expect(result.hasReachedLimit).toBe(true);
    expect(result.activeLimit).toBe(2);
  });

  it('should fall back to app-level config (config.user.maxActiveAds) when user limit is null', async () => {
    const mockListingsResponse = {
      listings: [{ id: 1, status: 'ACTIVE', createdAt: new Date().toISOString() }],
      total: 1,
      listingLimit: null,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockListingsResponse,
    } as Response);

    const expectedLimit = config.user.maxActiveAds;
    const result = await checkActiveAdsLimit('user-1');
    expect(result.activeCount).toBe(1);
    expect(result.hasReachedLimit).toBe(1 >= expectedLimit);
    expect(result.activeLimit).toBe(expectedLimit);
  });

  it('should correctly ignore expired ads when counting active ads', async () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - (config.listing.expiryDays + 5));

    const mockListingsResponse = {
      listings: [
        { id: 1, status: 'ACTIVE', createdAt: new Date().toISOString() }, // active
        { id: 2, status: 'ACTIVE', createdAt: expiredDate.toISOString() }, // expired
        { id: 3, status: 'DRAFT', createdAt: new Date().toISOString() }, // draft
      ],
      total: 3,
      listingLimit: 2,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockListingsResponse,
    } as Response);

    const result = await checkActiveAdsLimit('user-1');
    // Only listing 1 is active & not expired, so count should be 1
    expect(result.activeCount).toBe(1);
    expect(result.hasReachedLimit).toBe(false);
    expect(result.activeLimit).toBe(2);
  });

  it('should exclude the current listing being edited if excludeListingId is provided', async () => {
    const mockListingsResponse = {
      listings: [
        { id: 1, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 2, status: 'ACTIVE', createdAt: new Date().toISOString() },
      ],
      total: 2,
      listingLimit: 2,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockListingsResponse,
    } as Response);

    // Excluding listing 2, active count becomes 1
    const result = await checkActiveAdsLimit('user-1', 2);
    expect(result.activeCount).toBe(1);
    expect(result.hasReachedLimit).toBe(false);
    expect(result.activeLimit).toBe(2);
  });
});

describe('isListingExpired', () => {
  it('should return false for a listing created just now', () => {
    const now = new Date().toISOString();
    expect(isListingExpired(now)).toBe(false);
  });

  it('should return true for a listing created more than expiryDays ago', () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - (config.listing.expiryDays + 1));
    expect(isListingExpired(expiredDate.toISOString())).toBe(true);
  });

  it('should return false for a listing created just within the expiryDays limit', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - (config.listing.expiryDays - 1));
    expect(isListingExpired(recentDate.toISOString())).toBe(false);
  });
});

describe('getExpiryDate', () => {
  it('should return "Expired" if listing has expired', () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - (config.listing.expiryDays + 1));
    expect(getExpiryDate(expiredDate.toISOString())).toBe('Expired');
  });

  it('should return "Expires today" if the listing expires today', () => {
    const expiresTodayDate = new Date();
    expiresTodayDate.setDate(expiresTodayDate.getDate() - config.listing.expiryDays);
    expect(getExpiryDate(expiresTodayDate.toISOString())).toBe('Expires today');
  });

  it('should return "Expires in X days" if listing is active', () => {
    const activeDate = new Date();
    activeDate.setDate(activeDate.getDate() - (config.listing.expiryDays - 5));
    expect(getExpiryDate(activeDate.toISOString())).toBe('Expires in 5 days');
  });
});
