<script lang="ts">
  import '../app.css';
  import Icon from '@iconify/svelte';
  import { categoryList } from '$lib/categories/index';
  import { locations } from '$lib/locations';
  import SearchableSelect from '$lib/SearchableSelect.svelte';
</script>

<header class="border-b bg-base-100 shadow-sm">
  <div class="container mx-auto px-4">
    <!-- Top bar with logo and auth buttons -->
    <div class="flex h-16 items-center justify-between">
      <a href="/" class="flex items-center space-x-2">
        <Icon icon="material-symbols:store" class="text-primary" font-size="32" />
        <h1 class="text-xl font-bold tracking-tight">
          <span class="hidden lg:inline xl:hidden">JSC</span>
        </h1>
      </a>
      
      <div class="flex items-center space-x-3">
        <button class="btn btn-ghost btn-sm normal-case">Login</button>
        <button class="btn btn-primary btn-sm normal-case">Post Ad</button>
      </div>
    </div>

    <!-- Search bar section -->
    <div class="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:space-x-3">
      <div class="form-control flex-1">
        <SearchableSelect
          options={locations}
          placeholder="Select location..."
          icon="material-symbols:location-on"
        />
      </div>

      <div class="form-control flex-1">
        <SearchableSelect
          options={categoryList}
          placeholder="Select category..."
          icon="material-symbols:category"
        />
      </div>

      <div class="form-control flex-1">
        <div class="input-group relative">
          <input 
            type="text" 
            placeholder="Search for anything..." 
            class="input input-bordered w-full focus:outline-none" 
          />
          <button class="btn btn-square btn-primary absolute right-0 top-0 rounded-l-none">
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
        <span class="text-xl font-bold tracking-tight text-white">JS Classifieds</span>
      </a>
      <p class="mt-2 text-neutral-content/70">Your trusted marketplace for buying and selling in India</p>
    </div>

    <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
      <div>
        <h3 class="mb-4 flex items-center space-x-2 text-base font-semibold">
          <Icon icon="material-symbols:trending-up" class="text-accent" />
          <span class="text-white">Trending Searches</span>
        </h3>
        <div class="flex flex-wrap gap-2">
          <a href="#" class="badge badge-accent badge-outline hover:scale-105 transition-transform">Electronics</a>
          <a href="#" class="badge badge-accent badge-outline hover:scale-105 transition-transform">Cars</a>
          <a href="#" class="badge badge-accent badge-outline hover:scale-105 transition-transform">Real Estate</a>
          <a href="#" class="badge badge-accent badge-outline hover:scale-105 transition-transform">Jobs</a>
          <a href="#" class="badge badge-accent badge-outline hover:scale-105 transition-transform">Services</a>
        </div>
      </div>

      <div>
        <h3 class="mb-4 flex items-center space-x-2 text-base font-semibold">
          <Icon icon="material-symbols:category" class="text-accent" />
          <span class="text-white">Popular Categories</span>
        </h3>
        <ul class="space-y-2">
          {#each ['Mobiles', 'Vehicles', 'Property for Sale', 'Fashion & Beauty', 'Home & Garden'] as item}
            <li>
              <a 
                href="#{item}" 
                class="inline-flex items-center space-x-2 text-neutral-content/70 hover:text-white transition-all duration-200 hover:translate-x-1"
              >
                <Icon icon="material-symbols:chevron-right" class="text-accent/50" />
                <span>{item}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="mb-4 flex items-center space-x-2 text-base font-semibold">
          <Icon icon="material-symbols:business" class="text-accent" />
          <span class="text-white">Company</span>
        </h3>
        <ul class="space-y-2">
          {#each ['About Us', 'Contact Us', 'Terms & Conditions', 'Privacy Policy'] as item}
            <li>
              <a 
                href="#{item}" 
                class="inline-flex items-center space-x-2 text-neutral-content/70 hover:text-white transition-all duration-200 hover:translate-x-1"
              >
                <Icon icon="material-symbols:chevron-right" class="text-accent/50" />
                <span>{item}</span>
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
          {#each [
            { icon: 'line-md:facebook', label: 'Facebook' },
            { icon: 'line-md:instagram', label: 'Instagram' },
            { icon: 'line-md:twitter-x', label: 'Twitter' },
            { icon: 'line-md:youtube', label: 'YouTube' }
          ] as { icon, label }}
            <a 
              href="#" 
              class="text-neutral-content/70 hover:text-white transition-all duration-200 hover:scale-110" 
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
        &copy; {new Date().getFullYear()} JS Classifieds. All rights reserved.
      </p>
      <p class="mt-2 text-xs text-neutral-content/30">
        Made with ❤️ in India
      </p>
    </div>
  </div>
</footer>
