<script lang="ts">
    import Icon from '@iconify/svelte';
    import { locations } from '$lib/locations';
    import { categories } from '$lib/categories/categories';

    export let total: number;
    export let location: string | undefined = undefined;
    export let category: string | undefined = undefined;
    export let searchTerm: string | undefined = undefined;
</script>

<div class="mb-4 flex flex-wrap items-center gap-2 text-sm">
    <span class="font-medium">{total} results found</span>
    
    {#if searchTerm}
        <span class="text-gray-400">•</span>
        <div class="flex items-center gap-1 text-gray-600">
            <Icon icon="material-symbols:search" class="text-base" />
            <span>for "{searchTerm}"</span>
        </div>
    {/if}
    
    {#if location}
        <span class="text-gray-400">•</span>
        <div class="flex items-center gap-1 text-gray-600">
            <Icon icon="material-symbols:location-on" class="text-base" />
            <span>in {locations.find(loc => loc.key.toString() === location)?.value || ''}</span>
        </div>
    {/if}
    
    {#if category}
        <span class="text-gray-400">•</span>
        <div class="flex items-center gap-1 text-gray-600">
            <Icon icon="material-symbols:category" class="text-base" />
            <span>in {categories.find(cat => cat.key.toString() === category)?.value || ''}</span>
        </div>
    {/if}
</div>