<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/config';
  import type { ListingType, LocationType } from '$lib/types';
  import { locations as locationsData } from '$lib/locations';
  import Icon from '@iconify/svelte';
  import { SvelteURLSearchParams, SvelteMap } from 'svelte/reactivity';

  interface LocationCount {
    location: LocationType;
    count: number;
  }

  let locations: LocationCount[] = [];
  let isLoading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      const searchParams = new SvelteURLSearchParams();
      searchParams.set('limit', '200');
      searchParams.set('sortBy', 'createdAt');
      searchParams.set('order', 'desc');

      const response = await fetch(`${config.api.baseUrl}/listings?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch recent listings');
      }

      const result = await response.json();
      const listings: ListingType[] = result.listings || [];

      // Group by location and count
      const locationMap = new SvelteMap<number, LocationCount>();

      listings.forEach((listing: ListingType & { locationId?: number }) => {
        // Check if listing has locationId directly or location object
        const locationId =
          (listing as ListingType & { locationId?: number }).locationId || listing.location?.key;

        if (locationId) {
          // Find the matching location from our locations array
          const locationObj = locationsData.find((loc) => loc.key === locationId);

          if (locationObj) {
            if (locationMap.has(locationId)) {
              locationMap.get(locationId)!.count++;
            } else {
              // Convert to LocationType format
              locationMap.set(locationId, {
                location: {
                  key: locationObj.key,
                  value: locationObj.value,
                  name: locationObj.value,
                  state: listing.location?.state || '',
                },
                count: 1,
              });
            }
          }
        }
      });

      // Convert to array, sort by count, and take top 10
      locations = Array.from(locationMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (err) {
      console.error('Error fetching recent locations:', err);
      error = err instanceof Error ? err.message : 'Failed to load recent locations';
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
{:else if locations.length > 0}
  <div class="mb-8">
    <h2 class="mb-4 flex items-center gap-2 text-2xl font-bold">
      <Icon icon="material-symbols:location-on" class="text-primary" />
      Recent Locations
    </h2>
    <div class="rounded-lg border border-base-200 bg-base-100 p-4">
      <ul class="space-y-1">
        {#each locations as { location } (location.key)}
          <li>
            <a
              href="/search?location={location.key}"
              class="block rounded px-2 py-2 text-base-content transition-colors duration-200 hover:bg-base-200 hover:text-primary"
            >
              {location.value}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}
