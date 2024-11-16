<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import Icon from '@iconify/svelte';
    import { locations } from '$lib/locations';
    import { categories } from '$lib/categories/categories';
    import { formatCurrency, getExpiryDate } from '$lib/utils';
    import { config } from '$lib/config';
    import { selectedLocation, selectedCategory, searchTerm } from '$lib/stores/filters';

    /** @type {import('./$types').PageData} */
    export let data;

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
        <div class="flex gap-2">
            <button 
                class="btn btn-sm {sortBy === 'price' ? 'btn-primary' : 'btn-ghost'}"
                on:click={() => handleSort('price')}
                disabled={data.pagination.total === 0}
            >
                Price
                {#if sortBy === 'price'}
                    <Icon 
                        icon={order === 'asc' ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'} 
                    />
                {/if}
            </button>
            <button 
                class="btn btn-sm {sortBy === 'createdAt' ? 'btn-primary' : 'btn-ghost'}"
                on:click={() => handleSort('createdAt')}
                disabled={data.pagination.total === 0}
            >
                Date
                {#if sortBy === 'createdAt'}
                    <Icon 
                        icon={order === 'asc' ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'} 
                    />
                {/if}
            </button>
        </div>

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

    <!-- Results Count -->
    <div class="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span class="font-medium">{data.pagination.total} results found</span>
        {#if data.location || data.category || data.q}
            <span class="text-gray-400">•</span>
        {/if}
        {#if data.q}
            <div class="flex items-center gap-1 text-gray-600">
                <Icon icon="material-symbols:search" class="text-base" />
                <span>"{data.q}"</span>
            </div>
        {/if}
        {#if data.location}
            {#if data.q}
                <span class="text-gray-400">•</span>
            {/if}
            <div class="flex items-center gap-1 text-gray-600">
                <Icon icon="material-symbols:location-on" class="text-base" />
                <span>in {locations.find(loc => loc.key.toString() === data.location)?.value || ''}</span>
            </div>
        {/if}
        {#if data.category}
            {#if data.q || data.location}
                <span class="text-gray-400">•</span>
            {/if}
            <div class="flex items-center gap-1 text-gray-600">
                <Icon icon="material-symbols:category" class="text-base" />
                <span>in {categories.find(cat => cat.key.toString() === data.category)?.value || ''}</span>
            </div>
        {/if}
    </div>

    <!-- Listings Grid -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each data.listings as listing}
            <a 
                href="/list/{listing.slug}"
                class="card card-compact bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
            >
                <figure class="aspect-video bg-gray-100">
                    {#if listing.images?.[0]}
                        <img 
                            src={listing.images[0].path} 
                            alt={listing.title}
                            class="h-full w-full object-cover"
                        />
                    {:else}
                        <div class="flex h-full w-full items-center justify-center">
                            <Icon icon="material-symbols:image" class="text-4xl text-gray-400" />
                        </div>
                    {/if}
                </figure>
                <div class="card-body">
                    <h2 class="card-title text-lg line-clamp-2">{listing.title}</h2>
                    {#if listing.price}
                        <p class="text-xl font-bold text-primary">
                            {formatCurrency(Number(listing.price))}
                        </p>
                    {/if}
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2 text-sm text-gray-500">
                            <Icon icon="material-symbols:location-on" />
                            <span>{listing.location.name}, {listing.location.state}</span>
                        </div>
                        <div class="flex items-center gap-2 text-sm text-gray-500">
                            <Icon icon="material-symbols:schedule" />
                            <span>{getExpiryDate(listing.createdAt)}</span>
                        </div>
                    </div>
                </div>
            </a>
        {/each}
    </div>

    <!-- Pagination -->
    {#if data.pagination.totalPages > 1}
        <div class="mt-8 flex justify-center gap-2">
            <button 
                class="btn btn-ghost btn-sm"
                disabled={data.pagination.currentPage === 1}
                on:click={() => handlePageChange(data.pagination.currentPage - 1)}
            >
                <Icon icon="material-symbols:chevron-left" />
            </button>
            
            {#each Array(data.pagination.totalPages) as _, i}
                {@const pageNum = i + 1}
                <button 
                    class="btn btn-sm {data.pagination.currentPage === pageNum ? 'btn-primary' : 'btn-ghost'}"
                    on:click={() => handlePageChange(pageNum)}
                >
                    {pageNum}
                </button>
            {/each}
            
            <button 
                class="btn btn-ghost btn-sm"
                disabled={data.pagination.currentPage === data.pagination.totalPages}
                on:click={() => handlePageChange(data.pagination.currentPage + 1)}
            >
                <Icon icon="material-symbols:chevron-right" />
            </button>
        </div>
    {/if}

    <!-- No Results -->
    {#if data.listings.length === 0}
        <div class="mt-8 text-center">
            <Icon icon="material-symbols:search-off" class="text-6xl text-gray-400" />
            <p class="mt-4 text-xl font-medium">No listings found</p>
            <p class="mt-2 text-gray-600">Try adjusting your search criteria</p>
        </div>
    {/if}
</div>