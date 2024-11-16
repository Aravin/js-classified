<script lang="ts">
    import type { ListingType } from '$lib/types';
    import ListingCard from './ListingCard.svelte';
    import Icon from '@iconify/svelte';

    export let listings: ListingType[];
</script>

{#if listings.length > 0}
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each listings as listing}
            <ListingCard {listing} />
        {/each}
    </div>
{:else}
    <div class="mt-8 text-center">
        <Icon icon="material-symbols:search-off" class="text-6xl text-gray-400" />
        <p class="mt-4 text-xl font-medium">No listings found</p>
        <p class="mt-2 text-gray-600">Try adjusting your filters</p>
    </div>
{/if}