import { describe, expect, it } from 'vitest';
import { shouldLoadRewardSummary } from './reward-summary-load-state';

describe('shouldLoadRewardSummary', () => {
  it('allows the first authenticated load when there is no summary yet', () => {
    expect(
      shouldLoadRewardSummary({
        isInitializing: false,
        isAuthenticated: true,
        hasRewardSummary: false,
        hasAttemptedRewardLoad: false,
        isLoadingRewards: false,
      }),
    ).toBe(true);
  });

  it('blocks retries after a failed attempt until state is explicitly reset', () => {
    expect(
      shouldLoadRewardSummary({
        isInitializing: false,
        isAuthenticated: true,
        hasRewardSummary: false,
        hasAttemptedRewardLoad: true,
        isLoadingRewards: false,
      }),
    ).toBe(false);
  });

  it('blocks duplicate loads while a request is already in flight', () => {
    expect(
      shouldLoadRewardSummary({
        isInitializing: false,
        isAuthenticated: true,
        hasRewardSummary: false,
        hasAttemptedRewardLoad: false,
        isLoadingRewards: true,
      }),
    ).toBe(false);
  });
});
