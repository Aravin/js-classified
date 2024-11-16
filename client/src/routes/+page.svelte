<script lang="ts">
  import { categories } from '$lib/categories/categories';
  import type { Category } from '$lib/categories/categories';

  // Group categories by their parent category
  const groupedCategories = categories.reduce((acc, category) => {
    const [parent] = category.display.split(' > ');
    if (!acc[parent]) {
      acc[parent] = [];
    }
    acc[parent].push(category);
    return acc;
  }, {} as Record<string, Category[]>);
</script>

<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
  {#each Object.entries(groupedCategories) as [parentCategory, items]}
    <div class="card bg-base-100 border border-base-200 hover:shadow-lg hover:border-primary/20 transition-all duration-300">
      <div class="card-body p-5">
        <div class="border-l-4 border-primary pl-3 -ml-5">
          <h2 class="card-title text-base-content font-medium tracking-tight">{parentCategory}</h2>
          <p class="text-xs text-base-content/50 mt-0.5">{items.length} Subcategories</p>
        </div>
        <ul class="mt-4 space-y-1.5">
          {#each items as item}
            <li>
              <a 
                href="/category/{item.slug}?&category={item.key}" 
                class="text-base-content/70 hover:text-primary transition-colors duration-200 hover:pl-1"
              >
                {item.value}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/each}
</div>
