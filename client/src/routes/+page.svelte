<script lang="ts">
  import { categories } from '$lib/categories/categories';
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
  {#each Object.entries(categories) as [categoryName, subCategories]}
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">{categoryName}</h2>

        {#each Object.entries(subCategories) as [subCategoryName, nestedCategories]}
          <strong>{subCategoryName}</strong>

          {#each Object.entries(nestedCategories) as [nestedCategoryName, nestedCategoryValue]}
            {#if Array.isArray(nestedCategoryValue)}
              <ul class="ml-4 list-inside list-disc">
                {#each nestedCategoryValue as item}
                  <li>{item}</li>
                {/each}
              </ul>
            {:else if typeof nestedCategoryValue === 'string'}
              <span>{nestedCategoryValue}</span>
            {/if}
          {/each}
        {/each}
      </div>
    </div>
  {/each}
</div>
