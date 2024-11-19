<script lang="ts">
  import { isAuthenticated, login, logout, user, isLoading } from '$lib/auth/auth0';
  import Icon from '@iconify/svelte';
  import type { User } from '@auth0/auth0-spa-js';

  $: currentUser = $user as User | null;
</script>

<div class="flex items-center space-x-3">
  {#if $isLoading}
    <div class="flex items-center space-x-3">
      <div class="btn btn-ghost btn-sm normal-case gap-2 cursor-wait">
        <span class="loading loading-spinner loading-sm"></span>
        Loading...
      </div>
    </div>
  {:else if $isAuthenticated && currentUser}
    <a href="/post-ad" class="btn btn-primary btn-sm normal-case gap-2">
      <Icon icon="material-symbols:add" class="w-5 h-5" />
      Post Ad
    </a>
    <div class="dropdown dropdown-end">
      <label tabindex="0" class="btn btn-ghost btn-circle avatar ring-2 ring-primary/20 ring-offset-2 ring-offset-base-100">
        <div class="w-8 h-8 rounded-full overflow-hidden bg-base-200">
          {#if currentUser.picture}
            <img 
              src={currentUser.picture} 
              alt={currentUser.name} 
              referrerpolicy="no-referrer"
              class="w-full h-full object-cover"
            />
          {:else}
            <div class="flex items-center justify-center w-full h-full bg-primary text-primary-content text-lg font-medium">
              {currentUser.name?.[0]?.toUpperCase() || 'U'}
            </div>
          {/if}
        </div>
      </label>
      <ul tabindex="0" class="dropdown-content menu mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-56 border border-base-200">
        <li class="menu-title px-2 py-2">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-medium truncate">{currentUser.name}</span>
            <span class="text-xs text-base-content/60 truncate">{currentUser.email}</span>
          </div>
        </li>
        <div class="divider my-1"></div>
        <li>
          <a href="/my-ads" class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200">
            <Icon icon="material-symbols:list-alt" class="w-5 h-5" />
            <span>My Ads</span>
          </a>
        </li>
        <li>
          <a href="/settings" class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-base-200">
            <Icon icon="material-symbols:settings" class="w-5 h-5" />
            <span>Settings</span>
          </a>
        </li>
        <div class="divider my-1"></div>
        <li>
          <button 
            on:click={logout} 
            class="flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error/10 hover:text-error w-full"
          >
            <Icon icon="material-symbols:logout" class="w-5 h-5" />
            <span>Logout</span>
          </button>
        </li>
      </ul>
    </div>
  {:else}
    <a href="/post-ad" class="btn btn-primary btn-sm normal-case gap-2">
      <Icon icon="material-symbols:add" class="w-5 h-5" />
      Post Ad
    </a>
    <button on:click={login} class="btn btn-ghost btn-sm normal-case gap-2 hover:bg-base-200">
      <Icon icon="material-symbols:login" class="w-5 h-5" />
      Login
    </button>
  {/if}
</div>