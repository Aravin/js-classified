<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { locations } from '$lib/locations';
    import { categories } from '$lib/categories/categories';
    import { selectedLocation, selectedCategory, searchTerm } from '$lib/stores/filters';
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

    // Initialize filters from URL params
    $: {
        if (data.location) {
            const location = locations.find(loc => loc.key.toString() === data.location);
            if (location) $selectedLocation = location.value;
        }
        if (data.category) {
            const category = categories.find(cat => cat.key.toString() === data.category);
            if (category) $selectedCategory = category.value;
        }
        if (data.q) $searchTerm = data.q;
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

        goto(`/search?${params.toString()}`);
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
                            page: '1'  // Reset to first page when filter changes
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
        category={data.category}
        searchTerm={data.q}
    />

    <!-- Listings Grid -->
    <ListingGrid listings={data.listings} />

    <!-- Pagination -->
    <Pagination 
        {currentPage}
        {totalPages}
        onPageChange={handlePageChange}
    />
</div>