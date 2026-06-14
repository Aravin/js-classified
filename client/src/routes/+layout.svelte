<script lang="ts">
  import '../app.css';
  import Icon from '@iconify/svelte';
  import { categories } from '$lib/categories/categories';
  import { locations } from '$lib/locations';
  import SearchableSelect from '$lib/SearchableSelect.svelte';
  import { selectedLocation, selectedCategory, searchTerm } from '$lib/stores/filters';
  import { goto } from '$app/navigation';
  import AuthNav from '$lib/components/AuthNav.svelte';
  import { onMount } from 'svelte';
  import { initAuth0, authState } from '$lib/auth/auth0';
  import { browser } from '$app/environment';
  import { config } from '$lib/config';

  // Popular categories mapping - find best matching category
  const popularCategories = [
    { name: 'Mobiles', category: categories.find((c) => c.value === 'Mobile Phones') },
    { name: 'Vehicles', category: categories.find((c) => c.value === 'Car') },
    { name: 'Property for Sale', category: categories.find((c) => c.value === 'Apartments') },
    {
      name: 'Fashion & Beauty',
      category: categories.find((c) => c.display.includes('Fashion') && c.value === 'Men'),
    },
    {
      name: 'Home & Garden',
      category: categories.find(
        (c) => c.display.includes('Home & Furniture') && c.value === 'Sofas',
      ),
    },
  ];

  let locationSearch = $selectedLocation;
  let categorySearch = $selectedCategory;
  let search = $searchTerm;

  onMount(async () => {
    if (browser) {
      await initAuth0();

      // Initialize Google Analytics if configured
      if (config.googleAnalytics.id) {
        // Initialize dataLayer before loading gtag.js
        window.dataLayer = window.dataLayer || [];
        function gtag(...args: any[]) {
          window.dataLayer!.push(args);
        }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', config.googleAnalytics.id);

        // Load gtag.js script asynchronously
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${config.googleAnalytics.id}`;
        document.head.appendChild(script);
      }
    }
  });

  $: $selectedLocation = locationSearch;
  $: $selectedCategory = categorySearch;
  $: $searchTerm = search;

  async function handleSearch(event: Event) {
    event.preventDefault();

    const params = new URLSearchParams();

    if ($searchTerm) {
      params.set('q', $searchTerm);
    }
    if ($selectedLocation) {
      const location = locations.find((loc) => loc.value === $selectedLocation);
      if (location) {
        params.set('location', location.key.toString());
      }
    }
    if ($selectedCategory) {
      const category = categories.find((cat) => cat.value === $selectedCategory);
      if (category) {
        params.set('category', category.key.toString());
      }
    }

    const queryString = params.toString();
    await goto(`/search${queryString ? `?${queryString}` : ''}`);
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSearch(event);
    }
  }
</script>

<header class="border-b bg-base-100 shadow-sm">
  <div class="container mx-auto px-4">
    <!-- Top bar with logo and auth buttons -->
    <div class="flex h-16 items-center justify-between">
      <a href="/" class="flex items-center space-x-2">
        <Icon icon="material-symbols:store" class="text-primary" font-size="32" />
        <h1 class="text-xl font-bold tracking-tight">
          <span>locful.com</span>
        </h1>
      </a>

      <div class="flex items-center gap-3">
        <a href="/rewards" class="btn btn-ghost btn-sm normal-case">
          <Icon icon="material-symbols:workspace-premium" class="h-5 w-5" />
          Rewards
        </a>
        <a href="/leaderboard" class="btn btn-ghost btn-sm normal-case hidden sm:inline-flex">
          <Icon icon="material-symbols:leaderboard" class="h-5 w-5" />
          Leaderboard
        </a>
        <AuthNav />
      </div>
    </div>

    <!-- Search bar section -->
    <div class="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:space-x-3">
      <div class="form-control flex-1">
        <SearchableSelect
          options={locations}
          bind:searchTerm={locationSearch}
          placeholder="Select location..."
          icon="material-symbols:location-on"
        />
      </div>

      <div class="form-control flex-1">
        <SearchableSelect
          options={categories}
          bind:searchTerm={categorySearch}
          placeholder="Select category..."
          icon="material-symbols:category"
        />
      </div>

      <div class="form-control flex-1">
        <div class="input-group relative">
          <input
            type="text"
            placeholder="Search for anything..."
            class="input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Search listings"
            bind:value={search}
            on:keydown={handleKeyPress}
          />
          <button
            class="btn btn-square btn-primary absolute right-0 top-0 rounded-l-none"
            on:click={handleSearch}
          >
            <Icon icon="material-symbols:search" font-size="24" />
          </button>
        </div>
      </div>
    </div>
  </div>
</header>

<main class="container mx-auto min-h-[66vh] p-4">
  <slot />
</main>

<footer class="border-t bg-neutral">
  <div class="container mx-auto px-4 py-12">
    <!-- Logo and description -->
    <div class="mb-10 text-center">
      <a href="/" class="inline-flex items-center space-x-2">
        <Icon icon="material-symbols:store" class="text-accent" font-size="32" />
        <span class="text-xl font-bold tracking-tight text-white">Locful</span>
      </a>
      <p class="mt-2 text-neutral-content/70">
        Your trusted marketplace for buying and selling in India
      </p>
    </div>

    <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
      <div>
        <h3 class="mb-4 flex items-center space-x-2 text-base font-semibold">
          <Icon icon="material-symbols:trending-up" class="text-accent" />
          <span class="text-white">Trending Searches</span>
        </h3>
        <div class="flex flex-wrap gap-2">
          <a
            href="/search?q=Electronics"
            class="badge badge-accent badge-outline transition-transform hover:scale-105"
            >Electronics</a
          >
          <a
            href="/search?q=Cars"
            class="badge badge-accent badge-outline transition-transform hover:scale-105">Cars</a
          >
          <a
            href="/search?q=Real Estate"
            class="badge badge-accent badge-outline transition-transform hover:scale-105"
            >Real Estate</a
          >
          <a
            href="/search?q=Jobs"
            class="badge badge-accent badge-outline transition-transform hover:scale-105">Jobs</a
          >
          <a
            href="/search?q=Services"
            class="badge badge-accent badge-outline transition-transform hover:scale-105"
            >Services</a
          >
        </div>
      </div>

      <div>
        <h3 class="mb-4 flex items-center space-x-2 text-base font-semibold">
          <Icon icon="material-symbols:category" class="text-accent" />
          <span class="text-white">Popular Categories</span>
        </h3>
        <ul class="space-y-2">
          {#each popularCategories as item}
            {#if item.category}
              <li>
                <a
                  href="/category/{item.category.slug}?category={item.category.key}"
                  class="inline-flex items-center space-x-2 text-neutral-content/70 transition-all duration-200 hover:translate-x-1 hover:text-white"
                >
                  <Icon icon="material-symbols:chevron-right" class="text-accent/50" />
                  <span>{item.name}</span>
                </a>
              </li>
            {:else}
              <li>
                <a
                  href="/search?q={item.name}"
                  class="inline-flex items-center space-x-2 text-neutral-content/70 transition-all duration-200 hover:translate-x-1 hover:text-white"
                >
                  <Icon icon="material-symbols:chevron-right" class="text-accent/50" />
                  <span>{item.name}</span>
                </a>
              </li>
            {/if}
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="mb-4 flex items-center space-x-2 text-base font-semibold">
          <Icon icon="material-symbols:business" class="text-accent" />
          <span class="text-white">Company</span>
        </h3>
        <ul class="space-y-2">
          <li>
            <a
              href="/rewards"
              class="inline-flex items-center space-x-2 text-neutral-content/70 transition-all duration-200 hover:translate-x-1 hover:text-white"
            >
              <Icon icon="material-symbols:chevron-right" class="text-accent/50" />
              <span>Rewards Guide</span>
            </a>
          </li>
          <li>
            <a
              href="/leaderboard"
              class="inline-flex items-center space-x-2 text-neutral-content/70 transition-all duration-200 hover:translate-x-1 hover:text-white"
            >
              <Icon icon="material-symbols:chevron-right" class="text-accent/50" />
              <span>Leaderboard</span>
            </a>
          </li>
          {#each [{ name: 'About Us', url: 'https://www.exaful.com/about' }, { name: 'Career', url: 'https://www.exaful.com/career' }, { name: 'Contact Us', url: 'https://www.exaful.com/contact' }, { name: 'Terms of Use', url: 'https://www.exaful.com/policies/terms' }, { name: 'Privacy Policy', url: 'https://www.exaful.com/policies/privacy' }, { name: 'Refund Policy', url: 'https://www.exaful.com/policies/refund' }] as item}
            <li>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center space-x-2 text-neutral-content/70 transition-all duration-200 hover:translate-x-1 hover:text-white"
              >
                <Icon icon="material-symbols:chevron-right" class="text-accent/50" />
                <span>{item.name}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="mb-4 flex items-center space-x-2 text-base font-semibold">
          <Icon icon="material-symbols:share" class="text-accent" />
          <span class="text-white">Follow Us</span>
        </h3>
        <div class="flex space-x-6">
          {#each [{ icon: 'line-md:facebook', label: 'Facebook', url: 'https://www.fb.me/itarav' }, { icon: 'line-md:twitter-x', label: 'Twitter', url: 'https://twitter.com/itaravin' }, { icon: 'mdi:github', label: 'GitHub', url: 'https://github.com/Aravin/' }, { icon: 'mdi:linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/itaravin/' }, { icon: 'mdi:stack-overflow', label: 'Stack Overflow', url: 'https://stackoverflow.com/users/3058254/aravin' }] as { icon, label, url }}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              class="text-neutral-content/70 transition-all duration-200 hover:scale-110 hover:text-white"
              aria-label={label}
            >
              <Icon {icon} font-size="24" />
            </a>
          {/each}
        </div>
      </div>
    </div>

    <div class="mt-10 border-t border-neutral-content/10 pt-8 text-center">
      <p class="text-sm text-neutral-content/50">
        &copy; {new Date().getFullYear()} Locful. All rights reserved.
      </p>
      <p class="mt-2 text-xs text-neutral-content/30">Made with ❤️ in India</p>
    </div>
  </div>
</footer>
