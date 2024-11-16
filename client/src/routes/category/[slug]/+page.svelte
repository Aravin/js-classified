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

    // Initialize location from URL params
    $: {
        if (data.location) {
            const location = locations.find(loc => loc.key.toString() === data.location);
            if (location) $selectedLocation = location.value;
        }
    }

    function updateSearch(newParams: Record<string, string>) {
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
        <h1 class="text-2xl font-bold flex items-center gap-2">
            <Icon icon="material-symbols:category" />
            {data.category.value}
        </h1>
    </div>

    <!-- Filters and Sort -->
    <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <!-- Left side: Sort Buttons -->
        <SortButtons 
            {sortBy} 
            {order} 
            disabled={data.pagination.total === 0}
            onSort={handleSort}
        />

        <!-- Right side: Image Filter -->
        <div class="flex items-center">
            <label class="label cursor-pointer gap-2 {data.pagination.total === 0 ? 'cursor-not-allowed opacity-50' : ''}">
                <input 
                    type="checkbox" 
                    class="checkbox checkbox-primary checkbox-sm"
                    checked={data.hasImages}
                    disabled={data.pagination.total === 0}
                    on:change={(e) => {
                        updateSearch({ 
                            hasImages: e.currentTarget.checked ? 'true' : '',
                            page: '1'
                        });
                    }}
                />
                <span class="label-text">Show listings with images only</span>
            </label>
        </div>
    </div>

    <!-- Results Summary -->
    <ResultsSummary 
        total={data.pagination.total}
        location={data.location}
    />

    <!-- Listings Grid -->
    <ListingGrid listings={data.listings} />

    <!-- Pagination -->
    <Pagination 
        {currentPage}
        {totalPages}
        onPageChange={handlePageChange}
    />

    <!-- No Results -->
    {#if data.listings.length === 0}
        <div class="mt-8 text-center">
            <Icon icon="material-symbols:search-off" class="text-6xl text-gray-400" />
            <p class="mt-4 text-xl font-medium">No listings found</p>
            <p class="mt-2 text-gray-600">Try adjusting your filters</p>
        </div>
    {/if}
</div>