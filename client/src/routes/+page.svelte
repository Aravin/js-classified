<script lang="ts">
  import { categories } from '$lib/categories/categories';
  import type { Category } from '$lib/categories/categories';
  import RecentListings from '$lib/components/RecentListings.svelte';
  import RecentLocations from '$lib/components/RecentLocations.svelte';
  import RecentCategories from '$lib/components/RecentCategories.svelte';
  import Icon from '@iconify/svelte';

  // Group categories by their parent category
  const groupedCategories = categories.reduce((acc, category) => {
    const [parent] = category.display.split(' > ');
    if (!acc[parent]) {
      acc[parent] = [];
    }
    acc[parent].push(category);
    return acc;
  }, {} as Record<string, Category[]>);

  // Track expanded categories
  let expandedCategories: Record<string, boolean> = {};

  function toggleCategory(key: string) {
    expandedCategories[key] = !expandedCategories[key];
    expandedCategories = expandedCategories; // Trigger reactivity
  }

  // Category icons mapping
  const categoryIcons: Record<string, string> = {
    'Mobiles & Tablets': 'material-symbols:smartphone',
    'Computers & Laptops': 'material-symbols:computer',
    'Electronics & Appliances': 'material-symbols:devices',
    'Real Estate': 'material-symbols:home',
    'Vehicles & parts': 'material-symbols:directions-car',
    'Home & Furniture': 'material-symbols:chair',
    'Fashion': 'material-symbols:checkroom',
    'Home Services': 'material-symbols:build',
    'Jobs': 'material-symbols:work',
    'Books & Magazines': 'material-symbols:menu-book',
    'Hobbies & Sports': 'material-symbols:sports-soccer',
    'Pets': 'material-symbols:pets'
  };

  // Category gradient colors
  const categoryGradients: Record<string, string> = {
    'Mobiles & Tablets': 'from-blue-500 to-cyan-500',
    'Computers & Laptops': 'from-purple-500 to-indigo-500',
    'Electronics & Appliances': 'from-green-500 to-emerald-500',
    'Real Estate': 'from-orange-500 to-red-500',
    'Vehicles & parts': 'from-red-500 to-pink-500',
    'Home & Furniture': 'from-amber-500 to-orange-500',
    'Fashion': 'from-pink-500 to-rose-500',
    'Home Services': 'from-teal-500 to-cyan-500',
    'Jobs': 'from-slate-500 to-gray-500',
    'Books & Magazines': 'from-yellow-500 to-amber-500',
    'Hobbies & Sports': 'from-lime-500 to-green-500',
    'Pets': 'from-violet-500 to-purple-500'
  };

  function getCategoryIcon(category: string): string {
    return categoryIcons[category] || 'material-symbols:category';
  }

  function getCategoryGradient(category: string): string {
    return categoryGradients[category] || 'from-primary to-primary-focus';
  }
</script>

<!-- Hero Section -->
<section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary-focus via-secondary to-primary mb-16 rounded-3xl shadow-2xl border border-primary/20">
  <!-- Animated Background Elements -->
  <div class="absolute inset-0 overflow-hidden">
    <!-- Gradient Orbs -->
    <div class="absolute -top-20 -left-20 w-96 h-96 bg-secondary/30 rounded-full blur-3xl animate-pulse"></div>
    <div class="absolute -bottom-20 -right-20 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" style="animation-delay: 2s;"></div>
    
    <!-- Grid Pattern -->
    <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px); background-size: 40px 40px;"></div>
    
    <!-- Floating Icons -->
    <div class="absolute top-10 left-10 w-16 h-16 opacity-20 animate-bounce" style="animation-duration: 3s; animation-delay: 0s;">
      <Icon icon="material-symbols:store" class="w-full h-full text-white" />
    </div>
    <div class="absolute top-20 right-20 w-12 h-12 opacity-20 animate-bounce" style="animation-duration: 4s; animation-delay: 1s;">
      <Icon icon="material-symbols:local-offer" class="w-full h-full text-white" />
    </div>
    <div class="absolute bottom-20 left-20 w-14 h-14 opacity-20 animate-bounce" style="animation-duration: 3.5s; animation-delay: 0.5s;">
      <Icon icon="material-symbols:handshake" class="w-full h-full text-white" />
    </div>
    <div class="absolute bottom-10 right-10 w-10 h-10 opacity-20 animate-bounce" style="animation-duration: 4.5s; animation-delay: 1.5s;">
      <Icon icon="material-symbols:trending-up" class="w-full h-full text-white" />
    </div>
  </div>

  <!-- Main Content -->
  <div class="relative container mx-auto px-6 py-12 md:py-16 text-center z-10">
    <div class="max-w-4xl mx-auto">
      <!-- Badge -->
      <div class="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
        <Icon icon="material-symbols:sparkles" class="w-5 h-5 text-white animate-spin" style="animation-duration: 3s;" />
        <span class="text-sm font-semibold text-white">Your Trusted Local Marketplace</span>
        <Icon icon="material-symbols:sparkles" class="w-5 h-5 text-white animate-spin" style="animation-duration: 3s; animation-direction: reverse;" />
      </div>

      <!-- Main Heading with Gradient -->
      <h1 class="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 leading-tight tracking-tight">
        <span class="block bg-gradient-to-r from-white via-white/90 to-white/80 bg-clip-text text-transparent drop-shadow-2xl">
          Find Everything
        </span>
        <span class="block mt-2 bg-gradient-to-r from-secondary via-accent to-secondary bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
          You Need
        </span>
      </h1>

      <!-- Subheading -->
      <p class="text-xl md:text-2xl lg:text-3xl text-white/90 mb-4 leading-relaxed font-medium max-w-2xl mx-auto">
        Buy, sell, and discover amazing classifieds in your neighborhood
      </p>
      <p class="text-base md:text-lg text-white/70 mb-12 max-w-xl mx-auto">
        Connect with your community • Post free ads • Find great deals
      </p>

      <!-- CTA Buttons -->
      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
        <a 
          href="/search" 
          class="group relative px-8 py-4 bg-white text-primary rounded-full font-bold text-lg shadow-2xl hover:shadow-white/50 transform hover:scale-110 transition-all duration-300 overflow-hidden"
        >
          <span class="relative z-10 flex items-center gap-2">
            <Icon icon="material-symbols:search" class="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
            Browse Listings
          </span>
          <div class="absolute inset-0 bg-gradient-to-r from-secondary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </a>
        <a 
          href="/post-ad" 
          class="group relative px-8 py-4 bg-white/10 backdrop-blur-md text-white border-2 border-white/30 rounded-full font-bold text-lg hover:bg-white/20 hover:border-white/50 transform hover:scale-110 transition-all duration-300 shadow-xl"
        >
          <span class="relative z-10 flex items-center gap-2">
            <Icon icon="material-symbols:add-circle" class="w-6 h-6 group-hover:scale-125 transition-transform duration-300" />
            Post Free Ad
          </span>
        </a>
      </div>

      <!-- Stats/Features - Commented out for now, enable later -->
      <!--
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-8 border-t border-white/20">
        <div class="flex flex-col items-center">
          <div class="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-2 border border-white/20">
            <Icon icon="material-symbols:storefront" class="w-6 h-6 text-white" />
          </div>
          <div class="text-2xl font-bold text-white">1000+</div>
          <div class="text-sm text-white/80">Active Listings</div>
        </div>
        <div class="flex flex-col items-center">
          <div class="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-2 border border-white/20">
            <Icon icon="material-symbols:people" class="w-6 h-6 text-white" />
          </div>
          <div class="text-2xl font-bold text-white">500+</div>
          <div class="text-sm text-white/80">Active Users</div>
        </div>
        <div class="flex flex-col items-center">
          <div class="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-2 border border-white/20">
            <Icon icon="material-symbols:category" class="w-6 h-6 text-white" />
          </div>
          <div class="text-2xl font-bold text-white">50+</div>
          <div class="text-sm text-white/80">Categories</div>
        </div>
        <div class="flex flex-col items-center">
          <div class="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-2 border border-white/20">
            <Icon icon="material-symbols:verified" class="w-6 h-6 text-white" />
          </div>
          <div class="text-2xl font-bold text-white">100%</div>
          <div class="text-sm text-white/80">Free to Post</div>
        </div>
      </div>
      -->
    </div>
  </div>

  <!-- Decorative Bottom Wave -->
  <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent via-white/5 to-transparent"></div>
</section>

<!-- Categories Section -->
<section class="mb-16">
  <div class="text-center mb-12">
    <h2 class="text-4xl font-bold text-base-content mb-4">Browse Categories</h2>
    <p class="text-lg text-base-content/70 max-w-2xl mx-auto">
      Explore our wide range of categories to find exactly what you're looking for
    </p>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
    {#each Object.entries(groupedCategories) as [parentCategory, items]}
      {@const expandedKey = `expanded-${parentCategory}`}
      {@const isExpanded = expandedCategories[expandedKey]}
      <div class="group relative">
        <!-- Main Category Card -->
        <div class="relative overflow-hidden rounded-2xl bg-base-100 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-base-200/50">
          <!-- Gradient Accent Bar -->
          <div class="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r {getCategoryGradient(parentCategory)}"></div>
          
          <div class="p-6">
            <!-- Header with Icon -->
            <div class="flex items-start gap-4 mb-4">
              <div class="p-3 rounded-xl bg-gradient-to-br {getCategoryGradient(parentCategory)} shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Icon icon={getCategoryIcon(parentCategory)} class="w-6 h-6 text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-lg font-bold text-base-content mb-1 group-hover:text-primary transition-colors">
                  {parentCategory}
                </h3>
                <p class="text-xs text-base-content/60 font-medium">{items.length} categories</p>
              </div>
            </div>

            <!-- Subcategories List -->
            <div class="space-y-2">
              {#each items.slice(0, 4) as item}
                <a
                  href="/category/{item.slug}?category={item.key}"
                  class="block px-3 py-2 rounded-lg text-sm font-medium text-base-content/80 hover:text-primary hover:bg-primary/5 transition-all duration-200 group/item"
                >
                  <span class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover/item:bg-primary group-hover/item:scale-125 transition-all"></span>
                    {item.value}
                  </span>
                </a>
              {/each}
              
              {#if items.length > 4}
                <!-- Expanded items (shown when expanded) -->
                {#if isExpanded}
                  <div class="space-y-2">
                    {#each items.slice(4) as item, index}
                      <a
                        href="/category/{item.slug}?category={item.key}"
                        class="block px-3 py-2 rounded-lg text-sm font-medium text-base-content/80 hover:text-primary hover:bg-primary/5 transition-all duration-200 group/item"
                      >
                        <span class="flex items-center gap-2">
                          <span class="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover/item:bg-primary group-hover/item:scale-125 transition-all"></span>
                          {item.value}
                        </span>
                      </a>
                    {/each}
                  </div>
                {/if}
                
                <button
                  on:click={() => toggleCategory(expandedKey)}
                  class="w-full px-3 py-2 rounded-lg text-sm font-semibold text-primary hover:bg-primary/10 transition-all duration-200 mt-2 flex items-center justify-center gap-2 border border-primary/20 hover:border-primary/40"
                >
                  {#if isExpanded}
                    <Icon icon="material-symbols:expand-less" class="w-5 h-5" />
                    Show less
                  {:else}
                    <Icon icon="material-symbols:expand-more" class="w-5 h-5" />
                    View all {items.length} subcategories
                  {/if}
                </button>
              {/if}
            </div>
          </div>

          <!-- Hover Effect Glow -->
          <div class="absolute inset-0 bg-gradient-to-r {getCategoryGradient(parentCategory)} opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none rounded-2xl"></div>
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- Recent Listings Section -->
<div class="mt-12">
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
    <div class="lg:col-span-2">
      <RecentListings />
    </div>
    <div class="space-y-8">
      <RecentLocations />
      <RecentCategories />
    </div>
  </div>
</div>
