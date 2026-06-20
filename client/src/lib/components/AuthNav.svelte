<script lang="ts">
  import { isAuthenticated, login, logout, user, isLoading } from '$lib/auth/auth0';
  import Icon from '@iconify/svelte';
  import type { User } from '@auth0/auth0-spa-js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { getCachedRewardSummary, refreshRewardSummary } from '$lib/rewards';

  $: currentUser = $user as User | null;
  let rewardPoints: number | null = null;
  let isFetchingRewards = false;
  let lastLoadedUserId: string | null = null;

  $: if (browser && $isAuthenticated && currentUser?.sub) {
    if (currentUser.sub !== lastLoadedUserId) {
      lastLoadedUserId = currentUser.sub;
      void loadRewardPoints();
    }
  } else if (!$isAuthenticated) {
    lastLoadedUserId = null;
    rewardPoints = null;
  }

  async function loadRewardPoints() {
    if (isFetchingRewards) {
      return;
    }

    const cached = getCachedRewardSummary();
    if (cached) {
      rewardPoints = cached.points;
      return;
    }

    isFetchingRewards = true;
    try {
      const authHeader = await import('$lib/auth/auth0').then((module) => module.getAuthHeaders());
      const summary = await refreshRewardSummary(fetch, authHeader);
      if (!summary) {
        rewardPoints = null;
        return;
      }

      rewardPoints = summary.points ?? null;
    } catch {
      rewardPoints = null;
    } finally {
      isFetchingRewards = false;
    }
  }

  const handlePostAd = async () => {
    if ($isAuthenticated) {
      goto('/post-ad');
    } else {
      // Store the intended destination
      sessionStorage.setItem('redirectAfterLogin', '/post-ad');
      login();
    }
  };
</script>

<div class="flex items-center space-x-3">
  {#if $isLoading}
    <div class="flex items-center space-x-3">
      <div class="btn btn-ghost btn-sm cursor-wait gap-2 normal-case">
        <span class="loading loading-spinner loading-sm"></span>
        Loading...
      </div>
    </div>
  {:else if $isAuthenticated && currentUser}
    <button on:click={handlePostAd} class="btn btn-primary btn-sm gap-2 normal-case">
      <Icon icon="material-symbols:add" class="h-5 w-5" />
      Post Ad
    </button>
    <div class="dropdown dropdown-end">
      <button
        type="button"
        aria-label="Open user menu"
        class="avatar btn btn-circle btn-ghost btn-sm ring-2 ring-primary/20 ring-offset-2 ring-offset-base-100"
      >
        <div class="h-8 w-8 overflow-hidden rounded-full bg-base-200">
          {#if currentUser.picture}
            <img
              src={currentUser.picture}
              alt={currentUser.name}
              referrerpolicy="no-referrer"
              class="h-full w-full object-cover"
            />
          {:else}
            <div
              class="flex h-full w-full items-center justify-center bg-primary text-lg font-medium text-primary-content"
            >
              {currentUser.name?.[0]?.toUpperCase() || 'U'}
            </div>
          {/if}
        </div>
      </button>
      <div
        tabindex="0"
        role="menu"
        aria-label="User menu"
        class="dropdown-content z-50 mt-3 w-56 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg"
      >
        <ul class="menu">
          <li class="menu-title px-2 py-2">
            <div class="flex flex-col gap-0.5">
              <span class="truncate text-sm font-medium">{currentUser.name}</span>
              <span class="truncate text-xs text-base-content/60">{currentUser.email}</span>
              {#if rewardPoints !== null}
                <span
                  class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  <Icon icon="material-symbols:stars" class="h-4 w-4" />
                  {rewardPoints} points
                </span>
              {/if}
            </div>
          </li>
          <div class="divider my-1"></div>
          <li>
            <a href="/my-ads" class:active={$page.url.pathname.startsWith('/my-ads')}>
              <Icon icon="material-symbols:list-alt" class="h-5 w-5" />
              My Ads
            </a>
          </li>
          <li>
            <a href="/leaderboard" class:active={$page.url.pathname.startsWith('/leaderboard')}>
              <Icon icon="material-symbols:leaderboard" class="h-5 w-5" />
              Leaderboard
            </a>
          </li>
          <li>
            <a href="/rewards" class:active={$page.url.pathname.startsWith('/rewards')}>
              <Icon icon="material-symbols:menu-book" class="h-5 w-5" />
              Rewards Guide
            </a>
          </li>
          <li>
            <a href="/settings" class:active={$page.url.pathname.startsWith('/settings')}>
              <Icon icon="material-symbols:settings" class="h-5 w-5" />
              Settings
            </a>
          </li>
          <div class="divider my-1"></div>
          <li>
            <button on:click={logout} class="text-error">
              <Icon icon="material-symbols:logout" class="h-5 w-5" />
              Logout
            </button>
          </li>
        </ul>
      </div>
    </div>
  {:else}
    <button on:click={handlePostAd} class="btn btn-primary btn-sm gap-2 normal-case">
      <Icon icon="material-symbols:add" class="h-5 w-5" />
      Post Ad
    </button>
    <button on:click={login} class="btn btn-ghost btn-sm gap-2 normal-case hover:bg-base-200">
      <Icon icon="material-symbols:login" class="h-5 w-5" />
      Login
    </button>
  {/if}
</div>
