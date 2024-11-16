<script lang="ts">
    import type { ListingType } from '$lib/types';
    import Icon from '@iconify/svelte';
    import { formatCurrency, getExpiryDate } from '$lib/utils';

    export let listing: ListingType;
</script>

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