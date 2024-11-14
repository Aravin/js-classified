<script lang="ts">
  import { categories } from '$lib/categories/categories';
</script>

<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
  {#each Object.entries(categories) as [categoryName, items]}
    <div class="card bg-base-100 border border-base-200 hover:shadow-lg hover:border-primary/20 transition-all duration-300">
      <div class="card-body p-5">
        <div class="border-l-4 border-primary pl-3 -ml-5">
          <h2 class="card-title text-base-content font-medium tracking-tight">{categoryName}</h2>
          <p class="text-xs text-base-content/50 mt-0.5">{items.length} items</p>
        </div>
        <ul class="mt-4 space-y-1.5">
          {#each items as item}
            <li>
              <a 
                href="/{categoryName}/{item}" 
                class="text-base-content/70 hover:text-primary transition-colors duration-200 hover:pl-1"
              >
                {item}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/each}
</div>
