<script lang="ts">
  import { authState } from '$lib/auth/auth0';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';
  import { browser } from '$app/environment';

  let isLoading = true;
  let error: string | null = null;

  function redirectToLogin() {
    if (browser) {
      sessionStorage.setItem('redirectAfterLogin', '/settings');
      goto('/');
    }
  }

  $: if (!$authState.isInitializing && !$authState.isAuthenticated) {
    redirectToLogin();
  }

  $: if (!$authState.isInitializing && $authState.isAuthenticated) {
    isLoading = false;
  }
</script>

<svelte:head>
  <title>Settings - Locful</title>
</svelte:head>

{#if $authState.isInitializing || isLoading}
  <div class="container mx-auto px-4 py-8">
    <div class="flex items-center justify-center min-h-[400px]">
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
                <div class="w-20 h-20 rounded-full overflow-hidden bg-base-200">
                  {#if $authState.user.picture}
                    <img 
                      src={$authState.user.picture} 
                      alt={$authState.user.name || 'User'} 
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover"
                    />
                  {:else}
                    <div class="flex items-center justify-center w-full h-full bg-primary text-primary-content text-2xl font-medium">
                      {$authState.user.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  {/if}
                </div>
              </div>
              <div class="flex-1">
                <p class="text-lg font-semibold">{$authState.user.name || 'User'}</p>
                <p class="text-sm text-base-content/70">{$authState.user.email || 'No email'}</p>
                {#if $authState.user.sub}
                  <p class="text-xs text-base-content/50 mt-1">ID: {$authState.user.sub}</p>
                {/if}
              </div>
            </div>

            <div class="divider"></div>

            <div class="space-y-4">
              <div class="flex items-start gap-3">
                <Icon icon="material-symbols:person" class="text-base-content/50 w-5 h-5 flex-shrink-0 mt-0.5" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-base-content/70 mb-1">Name:</p>
                  <p class="text-sm text-base-content">{$authState.user.name || 'Not set'}</p>
                </div>
              </div>
              
              <div class="flex items-start gap-3">
                <Icon icon="material-symbols:mail" class="text-base-content/50 w-5 h-5 flex-shrink-0 mt-0.5" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-base-content/70 mb-1">Email:</p>
                  <p class="text-sm text-base-content break-all">{$authState.user.email || 'Not set'}</p>
                </div>
              </div>

              {#if $authState.user.email_verified !== undefined}
                <div class="flex items-start gap-3">
                  <Icon icon="material-symbols:verified" class="text-base-content/50 w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-base-content/70 mb-1">Email Verified:</p>
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
          </div>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="container mx-auto px-4 py-8">
    <div class="flex flex-col items-center justify-center min-h-[400px] text-center">
      <Icon icon="material-symbols:lock" class="text-6xl text-base-content/30 mb-4" />
      <h2 class="text-2xl font-bold mb-2">Authentication Required</h2>
      <p class="text-base-content/70 mb-6">Please log in to access your settings.</p>
      <button class="btn btn-primary" on:click={() => goto('/')}>
        Go to Homepage
      </button>
    </div>
  </div>
{/if}

