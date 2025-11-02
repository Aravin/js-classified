<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/config';
  import type { ListingType } from '$lib/types';
  import ListingGrid from './ListingGrid.svelte';
  import Icon from '@iconify/svelte';

  export let listing: ListingType;
  export let limit: number = 8;

  let relevantListings: ListingType[] = [];
  let isLoading = true;

  onMount(async () => {
    try {
      const searchParams = new URLSearchParams();
      searchParams.set('categoryId', listing.category.key.toString());
      searchParams.set('locationId', listing.location.key.toString());
      searchParams.set('limit', limit.toString());
      searchParams.set('sortBy', 'createdAt');
      searchParams.set('order', 'desc');

      const response = await fetch(
        `${config.api.baseUrl}/listings?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch relevant listings');
      }

      const result = await response.json();
      // Filter out the current listing
      relevantListings = (result.listings || []).filter(
        (l: ListingType) => l.id !== listing.id
      );
    } catch (err) {
      console.error('Error fetching relevant listings:', err);
    } finally {
      isLoading = false;
    }
  });
</script>

{#if isLoading}
  <div class="flex justify-center items-center py-8">
    <Icon icon="material-symbols:sync-outline" class="animate-spin text-2xl text-primary" />
  </div>
{:else if relevantListings.length > 0}
  <div class="mt-12">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
      <Icon icon="material-symbols:recommend" class="text-primary" />
      Similar Listings in {listing.location.name}
    </h2>
    <ListingGrid listings={relevantListings} />
  </div>
{/if}

