<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/config';
  import type { ListingType, CategoryType } from '$lib/types';
  import { categories as categoriesData } from '$lib/categories/categories';
  import Icon from '@iconify/svelte';

  interface CategoryCount {
    category: CategoryType;
    count: number;
  }

  let categories: CategoryCount[] = [];
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

      // Group by category and count
      const categoryMap = new Map<number, CategoryCount>();
      
      listings.forEach((listing: any) => {
        // Check if listing has categoryId directly or category object
        const categoryId = (listing as any).categoryId || listing.category?.id;
        
        if (categoryId) {
          // Find the matching category from our categories array
          const categoryObj = categoriesData.find(cat => cat.key === categoryId);
          
          if (categoryObj) {
            if (categoryMap.has(categoryId)) {
              categoryMap.get(categoryId)!.count++;
            } else {
              // Convert to CategoryType format
              categoryMap.set(categoryId, {
                category: {
                  key: categoryObj.key,
                  value: categoryObj.value,
                  slug: categoryObj.slug
                },
                count: 1
              });
            }
          }
        }
      });

      // Convert to array, sort by count, and take top 10
      categories = Array.from(categoryMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (err) {
      console.error('Error fetching recent categories:', err);
      error = err instanceof Error ? err.message : 'Failed to load recent categories';
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
{:else if categories.length > 0}
  <div class="mb-8">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
      <Icon icon="material-symbols:category" class="text-primary" />
      Recent Categories
    </h2>
    <div class="bg-base-100 border border-base-200 rounded-lg p-4">
      <ul class="space-y-1">
        {#each categories as { category }}
          <li>
            <a 
              href="/category/{category.slug}?category={category.key}" 
              class="block py-2 px-2 text-base-content hover:text-primary hover:bg-base-200 rounded transition-colors duration-200"
            >
              {category.value}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

