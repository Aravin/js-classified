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

      const response = await fetch(`${config.api.baseUrl}/listings?${searchParams.toString()}`);

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
  <div class="flex items-center justify-center py-12">
    <Icon icon="material-symbols:sync-outline" class="animate-spin text-4xl text-primary" />
  </div>
{:else if error}
  <div class="py-8 text-center text-error">
    <Icon icon="material-symbols:error-outline" class="mb-2 text-4xl" />
    <p>{error}</p>
  </div>
{:else if listings.length > 0}
  <div class="mb-8">
    <h2 class="mb-4 flex items-center gap-2 text-2xl font-bold">
      <Icon icon="material-symbols:schedule" class="text-primary" />
      Recent Listings
    </h2>
    <ListingGrid {listings} />
  </div>
{:else}
  <div class="mb-8">
    <h2 class="mb-4 flex items-center gap-2 text-2xl font-bold">
      <Icon icon="material-symbols:schedule" class="text-primary" />
      Recent Listings
    </h2>
    <div class="py-12 text-center text-base-content/60">
      <Icon icon="material-symbols:storefront-outline" class="mx-auto mb-3 text-5xl" />
      <p class="text-lg font-medium">No listings yet</p>
      <p class="mt-1 text-sm">
        Be the first to <a href="/post-ad" class="text-primary hover:underline">post an ad</a>!
      </p>
    </div>
  </div>
{/if}
