export interface RewardSummaryLoadState {
  isInitializing: boolean;
  isAuthenticated: boolean;
  hasRewardSummary: boolean;
  hasAttemptedRewardLoad: boolean;
  isLoadingRewards: boolean;
}

export function shouldLoadRewardSummary(state: RewardSummaryLoadState): boolean {
  return (
    !state.isInitializing &&
    state.isAuthenticated &&
    !state.hasRewardSummary &&
    !state.hasAttemptedRewardLoad &&
    !state.isLoadingRewards
  );
}