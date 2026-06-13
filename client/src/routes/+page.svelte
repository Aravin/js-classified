<script lang="ts">
  import { categories } from '$lib/categories/categories';
  import type { Category } from '$lib/categories/categories';
  import RecentListings from '$lib/components/RecentListings.svelte';
  import RecentLocations from '$lib/components/RecentLocations.svelte';
  import RecentCategories from '$lib/components/RecentCategories.svelte';
  import Icon from '@iconify/svelte';

  // Group categories by their parent category
  const groupedCategories = categories.reduce(
    (acc, category) => {
      const [parent] = category.display.split(' > ');
      if (!acc[parent]) {
        acc[parent] = [];
      }
      acc[parent].push(category);
      return acc;
    },
    {} as Record<string, Category[]>,
  );

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
    Fashion: 'material-symbols:checkroom',
    'Home Services': 'material-symbols:build',
    Jobs: 'material-symbols:work',
    'Books & Magazines': 'material-symbols:menu-book',
    'Hobbies & Sports': 'material-symbols:sports-soccer',
    Pets: 'material-symbols:pets',
  };

  // Category gradient colors
  const categoryGradients: Record<string, string> = {
    'Mobiles & Tablets': 'from-blue-500 to-cyan-500',
    'Computers & Laptops': 'from-purple-500 to-indigo-500',
    'Electronics & Appliances': 'from-green-500 to-emerald-500',
    'Real Estate': 'from-orange-500 to-red-500',
    'Vehicles & parts': 'from-red-500 to-pink-500',
    'Home & Furniture': 'from-amber-500 to-orange-500',
    Fashion: 'from-pink-500 to-rose-500',
    'Home Services': 'from-teal-500 to-cyan-500',
    Jobs: 'from-slate-500 to-gray-500',
    'Books & Magazines': 'from-yellow-500 to-amber-500',
    'Hobbies & Sports': 'from-lime-500 to-green-500',
    Pets: 'from-violet-500 to-purple-500',
  };

  function getCategoryIcon(category: string): string {
    return categoryIcons[category] || 'material-symbols:category';
  }

  function getCategoryGradient(category: string): string {
    return categoryGradients[category] || 'from-primary to-primary-focus';
  }
</script>

<svelte:head>
  <title>locful — Your Local Marketplace to Buy & Sell in India</title>
  <meta
    name="description"
    content="Find and post free classified ads in India. Browse listings for electronics, vehicles, real estate, jobs, furniture and more on locful.com."
  />
</svelte:head>

<!-- Recent Listings Section -->
<section class="mb-16 rounded-3xl border border-base-200 bg-base-200/30 p-6 shadow-sm md:p-10">
  <div class="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h2 class="mb-2 text-3xl font-black tracking-tight text-base-content md:text-4xl">
        Fresh Recommendations
      </h2>
      <p class="text-base text-base-content/70 md:text-lg">
        Discover the latest and most popular listings in your area
      </p>
    </div>
    <a
      href="/search"
      class="group flex items-center gap-2 rounded-full border border-base-200 bg-base-100 px-6 py-3 font-semibold text-base-content shadow-sm transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-content"
    >
      View All
      <Icon
        icon="material-symbols:arrow-forward"
        class="h-5 w-5 transition-transform group-hover:translate-x-1"
      />
    </a>
  </div>

  <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
    <div class="lg:col-span-2">
      <RecentListings />
    </div>
    <div class="space-y-8">
      <RecentLocations />
      <RecentCategories />
    </div>
  </div>
</section>

<!-- Hero Section -->
<section
  class="via-primary-focus relative mb-16 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary via-secondary to-primary shadow-2xl"
>
  <!-- Animated Background Elements -->
  <div class="absolute inset-0 overflow-hidden">
    <!-- Gradient Orbs -->
    <div
      class="absolute -left-20 -top-20 h-96 w-96 animate-pulse rounded-full bg-secondary/30 blur-3xl"
    ></div>
    <div
      class="absolute -bottom-20 -right-20 h-96 w-96 animate-pulse rounded-full bg-accent/30 blur-3xl"
      style="animation-delay: 1s;"
    ></div>
    <div
      class="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-primary/20 blur-3xl"
      style="animation-delay: 2s;"
    ></div>

    <!-- Grid Pattern -->
    <div
      class="absolute inset-0 opacity-10"
      style="background-image: radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px); background-size: 40px 40px;"
    ></div>

    <!-- Floating Icons -->
    <div
      class="absolute left-10 top-10 h-16 w-16 animate-bounce opacity-20"
      style="animation-duration: 3s; animation-delay: 0s;"
    >
      <Icon icon="material-symbols:store" class="h-full w-full text-white" />
    </div>
    <div
      class="absolute right-20 top-20 h-12 w-12 animate-bounce opacity-20"
      style="animation-duration: 4s; animation-delay: 1s;"
    >
      <Icon icon="material-symbols:local-offer" class="h-full w-full text-white" />
    </div>
    <div
      class="absolute bottom-20 left-20 h-14 w-14 animate-bounce opacity-20"
      style="animation-duration: 3.5s; animation-delay: 0.5s;"
    >
      <Icon icon="material-symbols:handshake" class="h-full w-full text-white" />
    </div>
    <div
      class="absolute bottom-10 right-10 h-10 w-10 animate-bounce opacity-20"
      style="animation-duration: 4.5s; animation-delay: 1.5s;"
    >
      <Icon icon="material-symbols:trending-up" class="h-full w-full text-white" />
    </div>
  </div>

  <!-- Main Content -->
  <div class="container relative z-10 mx-auto px-6 py-12 text-center md:py-16">
    <div class="mx-auto max-w-4xl">
      <!-- Badge -->
      <div
        class="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 shadow-lg backdrop-blur-md"
      >
        <Icon
          icon="material-symbols:sparkles"
          class="h-5 w-5 animate-spin text-white"
          style="animation-duration: 3s;"
        />
        <span class="text-sm font-semibold text-white">Your Trusted Local Marketplace</span>
        <Icon
          icon="material-symbols:sparkles"
          class="h-5 w-5 animate-spin text-white"
          style="animation-duration: 3s; animation-direction: reverse;"
        />
      </div>

      <!-- Main Heading with Gradient -->
      <h1
        class="mb-6 text-5xl font-black leading-tight tracking-tight text-white md:text-7xl lg:text-8xl"
      >
        <span
          class="block bg-gradient-to-r from-white via-white/90 to-white/80 bg-clip-text text-transparent drop-shadow-2xl"
        >
          Find Everything
        </span>
        <span
          class="animate-gradient mt-2 block bg-gradient-to-r from-secondary via-accent to-secondary bg-[length:200%_auto] bg-clip-text text-transparent"
        >
          You Need
        </span>
      </h1>

      <!-- Subheading -->
      <p
        class="mx-auto mb-4 max-w-2xl text-xl font-medium leading-relaxed text-white/90 md:text-2xl lg:text-3xl"
      >
        Buy, sell, and discover amazing classifieds in your neighborhood
      </p>
      <p class="mx-auto mb-12 max-w-xl text-base text-white/70 md:text-lg">
        Connect with your community • Post free ads • Find great deals
      </p>

      <!-- CTA Buttons -->
      <div class="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href="/search"
          class="group relative transform overflow-hidden rounded-full bg-white px-8 py-4 text-lg font-bold text-primary shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-white/50"
        >
          <span class="relative z-10 flex items-center gap-2">
            <Icon
              icon="material-symbols:search"
              class="h-6 w-6 transition-transform duration-300 group-hover:rotate-90"
            />
            Browse Listings
          </span>
          <div
            class="absolute inset-0 bg-gradient-to-r from-secondary to-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          ></div>
        </a>
        <a
          href="/post-ad"
          class="group relative transform rounded-full border-2 border-white/30 bg-white/10 px-8 py-4 text-lg font-bold text-white shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-white/50 hover:bg-white/20"
        >
          <span class="relative z-10 flex items-center gap-2">
            <Icon
              icon="material-symbols:add-circle"
              class="h-6 w-6 transition-transform duration-300 group-hover:scale-125"
            />
            Post Free Ad
          </span>
        </a>
      </div>

      <!-- Stats/Features -->
      <div class="mt-16 grid grid-cols-2 gap-6 border-t border-white/20 pt-8 md:grid-cols-4">
        <div class="flex flex-col items-center">
          <div
            class="group mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-inner backdrop-blur-md transition-all duration-300 hover:bg-white/20"
          >
            <Icon
              icon="material-symbols:storefront"
              class="h-6 w-6 text-white drop-shadow-md transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <div class="text-3xl font-black tracking-tight text-white drop-shadow-md">1000+</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-white/80">
            Active Listings
          </div>
        </div>
        <div class="flex flex-col items-center">
          <div
            class="group mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-inner backdrop-blur-md transition-all duration-300 hover:bg-white/20"
          >
            <Icon
              icon="material-symbols:people"
              class="h-6 w-6 text-white drop-shadow-md transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <div class="text-3xl font-black tracking-tight text-white drop-shadow-md">500+</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-white/80">
            Active Users
          </div>
        </div>
        <div class="flex flex-col items-center">
          <div
            class="group mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-inner backdrop-blur-md transition-all duration-300 hover:bg-white/20"
          >
            <Icon
              icon="material-symbols:category"
              class="h-6 w-6 text-white drop-shadow-md transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <div class="text-3xl font-black tracking-tight text-white drop-shadow-md">50+</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-white/80">
            Categories
          </div>
        </div>
        <div class="flex flex-col items-center">
          <div
            class="group mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-inner backdrop-blur-md transition-all duration-300 hover:bg-white/20"
          >
            <Icon
              icon="material-symbols:verified"
              class="h-6 w-6 text-white drop-shadow-md transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <div class="text-3xl font-black tracking-tight text-white drop-shadow-md">100%</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wider text-white/80">
            Free to Post
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Decorative Bottom Wave -->
  <div
    class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent via-white/5 to-transparent"
  ></div>
</section>

<!-- Categories Section -->
<section class="mb-16">
  <div class="mb-12 text-center">
    <h2 class="mb-4 text-4xl font-bold text-base-content">Browse Categories</h2>
    <p class="mx-auto max-w-2xl text-lg text-base-content/70">
      Explore our wide range of categories to find exactly what you're looking for
    </p>
  </div>

  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {#each Object.entries(groupedCategories) as [parentCategory, items]}
      {@const expandedKey = `expanded-${parentCategory}`}
      {@const isExpanded = expandedCategories[expandedKey]}
      <div class="group relative">
        <!-- Main Category Card -->
        <div
          class="relative transform overflow-hidden rounded-2xl border border-base-200/50 bg-base-100 shadow-md transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
        >
          <!-- Gradient Accent Bar -->
          <div
            class="absolute left-0 right-0 top-0 h-2 bg-gradient-to-r {getCategoryGradient(
              parentCategory,
            )}"
          ></div>

          <div class="p-6">
            <!-- Header with Icon -->
            <div class="mb-4 flex items-start gap-4">
              <div
                class="rounded-xl bg-gradient-to-br p-3 {getCategoryGradient(
                  parentCategory,
                )} shadow-lg transition-transform duration-300 group-hover:scale-110"
              >
                <Icon icon={getCategoryIcon(parentCategory)} class="h-6 w-6 text-white" />
              </div>
              <div class="min-w-0 flex-1">
                <h3
                  class="mb-1 text-lg font-bold text-base-content transition-colors group-hover:text-primary"
                >
                  {parentCategory}
                </h3>
                <p class="text-xs font-medium text-base-content/60">{items.length} categories</p>
              </div>
            </div>

            <!-- Subcategories List -->
            <div class="space-y-2">
              {#each items.slice(0, 4) as item}
                <a
                  href="/category/{item.slug}?category={item.key}"
                  class="group/item block rounded-lg px-3 py-2 text-sm font-medium text-base-content/80 transition-all duration-200 hover:bg-primary/5 hover:text-primary"
                >
                  <span class="flex items-center gap-2">
                    <span
                      class="h-1.5 w-1.5 rounded-full bg-primary/40 transition-all group-hover/item:scale-125 group-hover/item:bg-primary"
                    ></span>
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
                        class="group/item block rounded-lg px-3 py-2 text-sm font-medium text-base-content/80 transition-all duration-200 hover:bg-primary/5 hover:text-primary"
                      >
                        <span class="flex items-center gap-2">
                          <span
                            class="h-1.5 w-1.5 rounded-full bg-primary/40 transition-all group-hover/item:scale-125 group-hover/item:bg-primary"
                          ></span>
                          {item.value}
                        </span>
                      </a>
                    {/each}
                  </div>
                {/if}

                <button
                  on:click={() => toggleCategory(expandedKey)}
                  class="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 px-3 py-2 text-sm font-semibold text-primary transition-all duration-200 hover:border-primary/40 hover:bg-primary/10"
                >
                  {#if isExpanded}
                    <Icon icon="material-symbols:expand-less" class="h-5 w-5" />
                    Show less
                  {:else}
                    <Icon icon="material-symbols:expand-more" class="h-5 w-5" />
                    View all {items.length} subcategories
                  {/if}
                </button>
              {/if}
            </div>
          </div>

          <!-- Hover Effect Glow -->
          <div
            class="absolute inset-0 bg-gradient-to-r {getCategoryGradient(
              parentCategory,
            )} pointer-events-none rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-5"
          ></div>
        </div>
      </div>
    {/each}
  </div>
</section>
