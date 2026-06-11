<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/config';
  import type { ListingType } from '$lib/types';
  import ListingGrid from './ListingGrid.svelte';
  import Icon from '@iconify/svelte';

  let listings: ListingType[] = [];
  let isLoading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', '10');
      searchParams.set('sortBy', 'createdAt');
      searchParams.set('order', 'desc');

      const response = await fetch(
        `${config.api.baseUrl}/listings?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch recent listings');
      }

      const result = await response.json();
      listings = result.listings || [];
    } catch (err) {
      console.error('Error fetching recent listings:', err);
      error = err instanceof Error ? err.message : 'Failed to load recent listings';
    } finally {
      isLoading = false;
    }
  });
</script>

{#if isLoading}
  <div class="flex justify-center items-center py-12">
    <Icon icon="material-symbols:sync-outline" class="animate-spin text-4xl text-primary" />
  </div>
{:else if error}
  <div class="text-center py-8 text-error">
    <Icon icon="material-symbols:error-outline" class="text-4xl mb-2" />
    <p>{error}</p>
  </div>
{:else if listings.length > 0}
  <div class="mb-8">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
      <Icon icon="material-symbols:schedule" class="text-primary" />
      Recent Listings
    </h2>
    <ListingGrid {listings} />
  </div>
{:else}
  <div class="mb-8">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
      <Icon icon="material-symbols:schedule" class="text-primary" />
      Recent Listings
    </h2>
    <div class="text-center py-12 text-base-content/60">
      <Icon icon="material-symbols:storefront-outline" class="text-5xl mb-3 mx-auto" />
      <p class="text-lg font-medium">No listings yet</p>
      <p class="text-sm mt-1">Be the first to <a href="/post-ad" class="text-primary hover:underline">post an ad</a>!</p>
    </div>
  </div>
{/if}

