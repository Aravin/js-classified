<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';
  import { locations } from '$lib/locations';
  import { selectedLocation } from '$lib/stores/filters';
  import type { PageData } from './$types';
  import ListingGrid from '$lib/components/ListingGrid.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import ResultsSummary from '$lib/components/ResultsSummary.svelte';
  import SortButtons from '$lib/components/SortButtons.svelte';

  export let data: PageData;

  let currentPage = data.pagination.currentPage;
  let totalPages = data.pagination.totalPages;
  let sortBy = data.sortBy;
  let order = data.order;

  // Reactive checkbox state from URL
  $: hasImages = data.hasImages ?? false;

  // Initialize location from URL params
  $: {
    if (data.location) {
      const location = locations.find((loc) => loc.key.toString() === data.location);
      if (location) $selectedLocation = location.value;
    }
  }

  function updateSearch(newParams: Record<string, string>) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const params = new URLSearchParams($page.url.searchParams);

    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    goto(`/category/${data.slug}?${params.toString()}`);
  }

  function handleSort(newSortBy: string) {
    const newOrder = sortBy === newSortBy && order === 'asc' ? 'desc' : 'asc';
    sortBy = newSortBy;
    order = newOrder;
    updateSearch({ sortBy, order, page: '1' });
  }

  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage = newPage;
      updateSearch({ page: newPage.toString() });
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <!-- Category Header -->
  <div class="mb-8">
    <h1 class="flex items-center gap-2 text-2xl font-bold">
      <Icon icon="material-symbols:category" />
      {data.category.value}
    </h1>
  </div>

  <!-- Filters and Sort -->
  <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
    <!-- Left side: Sort Buttons -->
    <SortButtons {sortBy} {order} disabled={data.pagination.total === 0} onSort={handleSort} />

    <!-- Right side: Image Filter -->
    <div class="flex items-center">
      <label
        class="label cursor-pointer gap-2 {data.pagination.total === 0
          ? 'cursor-not-allowed opacity-50'
          : ''}"
      >
        <input
          type="checkbox"
          class="checkbox-primary checkbox checkbox-sm"
          checked={hasImages}
          disabled={data.pagination.total === 0}
          on:change={(e) => {
            updateSearch({
              hasImages: e.currentTarget.checked ? 'true' : '',
              page: '1',
            });
          }}
        />
        <span class="label-text">Show listings with images only</span>
      </label>
    </div>
  </div>

  <!-- Results Summary -->
  <ResultsSummary total={data.pagination.total} location={data.location} />

  <!-- Fallback Note -->
  {#if data.fallbackType && data.fallbackType !== 'none' && data.listings.length > 0}
    <div class="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
      <div class="flex items-start gap-2">
        <Icon icon="material-symbols:info-outline" class="mt-0.5 flex-shrink-0 text-warning" />
        <div class="text-sm">
          <p class="font-medium text-warning-content">
            No matching results found for your exact search criteria.
          </p>
          <p class="mt-1 text-warning-content/80">
            {#if data.fallbackType === 'category'}
              Showing listings from other categories in {locations.find(
                (loc) => loc.key.toString() === data.location,
              )?.value || 'your location'}.
            {:else if data.fallbackType === 'location'}
              Showing listings from {data.category.value} in other locations.
            {:else if data.fallbackType === 'hasImages'}
              {#if data.location}
                Showing all listings (including those without images) in {locations.find(
                  (loc) => loc.key.toString() === data.location,
                )?.value || 'your location'}.
              {:else}
                Showing all listings (including those without images).
              {/if}
            {/if}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Listings Grid -->
  <ListingGrid listings={data.listings} />

  <!-- Pagination -->
  {#if data.listings.length > 0}
    <Pagination {currentPage} {totalPages} onPageChange={handlePageChange} />
  {/if}
</div>
