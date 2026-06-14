<script lang="ts">
  import { authState } from '$lib/auth/auth0';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';
  import { browser } from '$app/environment';
  import { getAuthHeaders } from '$lib/auth/auth0';
  import { shouldLoadRewardSummary } from '$lib/reward-summary-load-state';
  import {
    getCachedRewardSummary,
    refreshRewardSummary,
    type RewardSummary,
  } from '$lib/rewards';

  let isLoading = true;
  let error: string | null = null;
  let rewardSummary: RewardSummary | null = null;
  let hasAttemptedRewardLoad = false;
  let isLoadingRewards = false;
  let lastLoadedUserId: string | null = null;

  function redirectToLogin() {
    if (browser) {
      sessionStorage.setItem('redirectAfterLogin', '/settings');
      goto('/');
    }
  }

  $: if (!$authState.isInitializing && !$authState.isAuthenticated) {
    if (lastLoadedUserId !== null) {
      lastLoadedUserId = null;
      hasAttemptedRewardLoad = false;
      rewardSummary = null;
      error = null;
    }
    redirectToLogin();
  }

  $: if (!$authState.isInitializing && $authState.isAuthenticated) {
    const currentUserId = $authState.user?.sub ?? null;
    if (currentUserId !== lastLoadedUserId) {
      lastLoadedUserId = currentUserId;
      hasAttemptedRewardLoad = false;
      rewardSummary = null;
      error = null;
    }
    isLoading = false;
    if (
      shouldLoadRewardSummary({
        isInitializing: $authState.isInitializing,
        isAuthenticated: $authState.isAuthenticated,
        hasRewardSummary: rewardSummary !== null,
        hasAttemptedRewardLoad,
        isLoadingRewards,
      })
    ) {
      void loadRewardSummary();
    }
  }

  async function loadRewardSummary() {
    hasAttemptedRewardLoad = true;
    isLoadingRewards = true;

    try {
      const cached = getCachedRewardSummary();
      if (cached) {
        rewardSummary = cached;
        error = null;
        return;
      }

      const authHeaders = await getAuthHeaders();
      rewardSummary = await refreshRewardSummary(fetch, authHeaders);
      error = null;
    } catch {
      rewardSummary = null;
      error = 'Failed to load rewards summary.';
    } finally {
      isLoadingRewards = false;
    }
  }
</script>

<svelte:head>
  <title>Settings - Locful</title>
</svelte:head>

{#if $authState.isInitializing || isLoading}
  <div class="container mx-auto px-4 py-8">
    <div class="flex min-h-[400px] items-center justify-center">
      <div class="text-center">
        <span class="loading loading-spinner loading-lg"></span>
        <p class="mt-4 text-base-content/70">Loading settings...</p>
      </div>
    </div>
  </div>
{:else if $authState.isAuthenticated && $authState.user}
  <div class="container mx-auto px-4 py-8">
    <div class="mb-8">
      <h1 class="flex items-center gap-2 text-3xl font-bold">
        <Icon icon="material-symbols:settings" />
        Settings
      </h1>
      <p class="mt-2 text-base-content/70">Manage your account settings and preferences</p>
    </div>

    {#if error}
      <div class="alert alert-error mb-6">
        <Icon icon="material-symbols:error-outline" />
        <span>{error}</span>
      </div>
    {/if}

    <div class="grid gap-6 md:grid-cols-2">
      <!-- Profile Information -->
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-2">
            <Icon icon="material-symbols:account-circle" />
            Profile Information
          </h2>

          <div class="mt-4 space-y-4">
            <div class="flex items-center gap-4">
              <div class="avatar">
                <div class="h-20 w-20 overflow-hidden rounded-full bg-base-200">
                  {#if $authState.user.picture}
                    <img
                      src={$authState.user.picture}
                      alt={$authState.user.name || 'User'}
                      referrerpolicy="no-referrer"
                      class="h-full w-full object-cover"
                    />
                  {:else}
                    <div
                      class="flex h-full w-full items-center justify-center bg-primary text-2xl font-medium text-primary-content"
                    >
                      {$authState.user.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  {/if}
                </div>
              </div>
              <div class="flex-1">
                <p class="text-lg font-semibold">{$authState.user.name || 'User'}</p>
                <p class="text-sm text-base-content/70">{$authState.user.email || 'No email'}</p>
                {#if $authState.user.sub}
                  <p class="mt-1 text-xs text-base-content/50">ID: {$authState.user.sub}</p>
                {/if}
              </div>
            </div>

            <div class="divider"></div>

            <div class="space-y-4">
              <div class="flex items-start gap-3">
                <Icon
                  icon="material-symbols:person"
                  class="mt-0.5 h-5 w-5 flex-shrink-0 text-base-content/50"
                />
                <div class="min-w-0 flex-1">
                  <p class="mb-1 text-sm font-medium text-base-content/70">Name:</p>
                  <p class="text-sm text-base-content">{$authState.user.name || 'Not set'}</p>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <Icon
                  icon="material-symbols:mail"
                  class="mt-0.5 h-5 w-5 flex-shrink-0 text-base-content/50"
                />
                <div class="min-w-0 flex-1">
                  <p class="mb-1 text-sm font-medium text-base-content/70">Email:</p>
                  <p class="break-all text-sm text-base-content">
                    {$authState.user.email || 'Not set'}
                  </p>
                </div>
              </div>

              {#if $authState.user.email_verified !== undefined}
                <div class="flex items-start gap-3">
                  <Icon
                    icon="material-symbols:verified"
                    class="mt-0.5 h-5 w-5 flex-shrink-0 text-base-content/50"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="mb-1 text-sm font-medium text-base-content/70">Email Verified:</p>
                    <p class="text-sm text-base-content">
                      {$authState.user.email_verified ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-2">
            <Icon icon="material-symbols:flash-on" />
            Quick Actions
          </h2>

          <div class="mt-4 flex flex-col gap-3">
            <a href="/my-ads" class="btn btn-outline w-full justify-start gap-2">
              <Icon icon="material-symbols:list-alt" />
              View My Ads
            </a>
            <a href="/post-ad" class="btn btn-primary w-full justify-start gap-2">
              <Icon icon="material-symbols:add" />
              Post New Ad
            </a>
            <a href="/leaderboard" class="btn btn-outline w-full justify-start gap-2">
              <Icon icon="material-symbols:leaderboard" />
              View Leaderboard
            </a>
            <a href="/rewards" class="btn btn-outline w-full justify-start gap-2">
              <Icon icon="material-symbols:menu-book" />
              Rewards Guide
            </a>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow-xl md:col-span-2">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-2">
            <Icon icon="material-symbols:workspace-premium" />
            Rewards Summary
          </h2>

          {#if rewardSummary}
            <div class="mt-4 grid gap-4 md:grid-cols-3">
              <div class="rounded-2xl bg-primary/10 p-5">
                <p class="text-xs font-semibold uppercase tracking-wide text-primary">Points</p>
                <p class="mt-2 text-3xl font-black text-primary">{rewardSummary.points}</p>
              </div>
              <div class="rounded-2xl bg-secondary/10 p-5">
                <p class="text-xs font-semibold uppercase tracking-wide text-secondary">All-time rank</p>
                <p class="mt-2 text-3xl font-black text-secondary">
                  {rewardSummary.ranks.allTime ? `#${rewardSummary.ranks.allTime}` : 'Unranked'}
                </p>
              </div>
              <div class="rounded-2xl bg-accent/10 p-5">
                <p class="text-xs font-semibold uppercase tracking-wide text-accent">Monthly rank</p>
                <p class="mt-2 text-3xl font-black text-accent">
                  {rewardSummary.ranks.monthly ? `#${rewardSummary.ranks.monthly}` : 'Unranked'}
                </p>
              </div>
            </div>

            <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <div class="mb-3 flex items-center gap-2">
                  <Icon icon="material-symbols:receipt-long" class="text-base-content/60" />
                  <h3 class="text-lg font-semibold text-base-content">Points breakdown</h3>
                </div>

                {#if rewardSummary.breakdown.length > 0}
                  <div class="overflow-hidden rounded-2xl border border-base-200 bg-base-200/30">
                    <div class="grid grid-cols-[minmax(0,1fr)_96px_96px] gap-3 border-b border-base-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                      <span>Reward type</span>
                      <span class="text-right">Count</span>
                      <span class="text-right">Points</span>
                    </div>

                    {#each rewardSummary.breakdown as item}
                      <div class="grid grid-cols-[minmax(0,1fr)_96px_96px] gap-3 border-b border-base-200/70 px-4 py-3 last:border-b-0">
                        <div>
                          <p class="font-semibold text-base-content">{item.title}</p>
                          <p class="text-sm text-base-content/60">
                            {item.count} {item.count === 1 ? 'reward event' : 'reward events'}
                          </p>
                        </div>
                        <p class="text-right font-semibold text-base-content/70">{item.count}</p>
                        <p class="text-right font-black text-primary">+{item.points}</p>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="rounded-2xl bg-base-200/70 p-4 text-sm text-base-content/70">
                    No reward events yet.
                  </div>
                {/if}
              </div>

              <div>
                <div class="mb-3 flex items-center gap-2">
                  <Icon icon="material-symbols:history" class="text-base-content/60" />
                  <h3 class="text-lg font-semibold text-base-content">Recent rewards</h3>
                </div>

                {#if rewardSummary.recentRewards.length > 0}
                  <div class="space-y-3">
                    {#each rewardSummary.recentRewards as reward}
                      <div class="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
                        <div class="flex items-start justify-between gap-3">
                          <div>
                            <p class="font-semibold text-base-content">
                              {rewardSummary.breakdown.find((item) => item.action === reward.action)?.title || reward.action}
                            </p>
                            <p class="mt-1 text-sm text-base-content/60">
                              {new Date(reward.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <p class="text-lg font-black text-primary">+{reward.points}</p>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="rounded-2xl bg-base-200/70 p-4 text-sm text-base-content/70">
                    Rewards will show here after your first eligible activity.
                  </div>
                {/if}
              </div>
            </div>
          {:else}
            <div class="mt-4 rounded-2xl bg-base-200/70 p-4 text-sm text-base-content/70">
              Rewards will appear here after your first eligible activity.
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="container mx-auto px-4 py-8">
    <div class="flex min-h-[400px] flex-col items-center justify-center text-center">
      <Icon icon="material-symbols:lock" class="mb-4 text-6xl text-base-content/30" />
      <h2 class="mb-2 text-2xl font-bold">Authentication Required</h2>
      <p class="mb-6 text-base-content/70">Please log in to access your settings.</p>
      <button class="btn btn-primary" on:click={() => goto('/')}> Go to Homepage </button>
    </div>
  </div>
{/if}
