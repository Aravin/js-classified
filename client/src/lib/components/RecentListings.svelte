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
{/if}

