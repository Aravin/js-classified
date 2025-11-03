<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/config';
  import type { ListingType, LocationType } from '$lib/types';
  import { locations as locationsData } from '$lib/locations';
  import Icon from '@iconify/svelte';

  interface LocationCount {
    location: LocationType;
    count: number;
  }

  let locations: LocationCount[] = [];
  let isLoading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', '200');
      searchParams.set('sortBy', 'createdAt');
      searchParams.set('order', 'desc');

      const response = await fetch(
        `${config.api.baseUrl}/listings?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch recent listings');
      }

      const result = await response.json();
      const listings: ListingType[] = result.listings || [];

      // Group by location and count
      const locationMap = new Map<number, LocationCount>();
      
      listings.forEach((listing: any) => {
        // Check if listing has locationId directly or location object
        const locationId = (listing as any).locationId || listing.location?.id;
        
        if (locationId) {
          // Find the matching location from our locations array
          const locationObj = locationsData.find(loc => loc.key === locationId);
          
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
                  state: listing.location?.state || ''
                },
                count: 1
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
  <div class="flex justify-center items-center py-12">
    <Icon icon="material-symbols:sync-outline" class="animate-spin text-4xl text-primary" />
  </div>
{:else if error}
  <div class="text-center py-8 text-error">
    <Icon icon="material-symbols:error-outline" class="text-4xl mb-2" />
    <p>{error}</p>
  </div>
{:else if locations.length > 0}
  <div class="mb-8">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
      <Icon icon="material-symbols:location-on" class="text-primary" />
      Recent Locations
    </h2>
    <div class="bg-base-100 border border-base-200 rounded-lg p-4">
      <ul class="space-y-1">
        {#each locations as { location }}
          <li>
            <a 
              href="/search?locationId={location.key}" 
              class="block py-2 px-2 text-base-content hover:text-primary hover:bg-base-200 rounded transition-colors duration-200"
            >
              {location.value}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

