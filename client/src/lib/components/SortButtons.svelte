<script lang="ts">
    import Icon from '@iconify/svelte';

    export let sortBy: string;
    export let order: string;
    export let disabled: boolean = false;
    export let onSort: (sortBy: string) => void;
</script>

<div class="flex gap-2">
    <button 
        class="btn btn-sm {sortBy === 'price' ? 'btn-primary' : 'btn-ghost'}"
        on:click={() => onSort('price')}
        {disabled}
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
        on:click={() => onSort('createdAt')}
        {disabled}
    >
        Date
        {#if sortBy === 'createdAt'}
            <Icon 
                icon={order === 'asc' ? 'material-symbols:arrow-upward' : 'material-symbols:arrow-downward'} 
            />
        {/if}
    </button>
</div>