<script lang="ts">
    import Icon from '@iconify/svelte';

    export let currentPage: number;
    export let totalPages: number;
    export let onPageChange: (page: number) => void;

    function getPaginationRange(current: number, total: number) {
        const delta = 2;
        const range: (number | string)[] = [];

        for (let i = 1; i <= total; i++) {
            if (
                i === 1 || // First page
                i === total || // Last page
                i >= current - delta && i <= current + delta // Pages around current
            ) {
                range.push(i);
            } else if (range[range.length - 1] !== '...') {
                range.push('...');
            }
        }

        return range;
    }
</script>

{#if totalPages > 1}
    <div class="mt-8 flex flex-wrap justify-center gap-2">
        <button 
            class="btn btn-ghost btn-sm"
            disabled={currentPage === 1}
            on:click={() => onPageChange(currentPage - 1)}
        >
            <Icon icon="material-symbols:chevron-left" />
        </button>
        
        {#each getPaginationRange(currentPage, totalPages) as item}
            {#if item === '...'}
                <span class="flex h-8 w-8 items-center justify-center">...</span>
            {:else}
                <button 
                    class="btn btn-sm {currentPage === item ? 'btn-primary' : 'btn-ghost'}"
                    on:click={() => onPageChange(item as number)}
                >
                    {item}
                </button>
            {/if}
        {/each}
        
        <button 
            class="btn btn-ghost btn-sm"
            disabled={currentPage === totalPages}
            on:click={() => onPageChange(currentPage + 1)}
        >
            <Icon icon="material-symbols:chevron-right" />
        </button>
    </div>
{/if}