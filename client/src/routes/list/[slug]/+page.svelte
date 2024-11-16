<script lang="ts">
  import { formatDate } from '$lib/utils';
  import Icon from '@iconify/svelte';

  export let data;
  const { listing } = data;
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  <div class="bg-white rounded-lg shadow-lg overflow-hidden">
    <!-- Image Gallery -->
    {#if listing.images && listing.images.length > 0}
      <div class="relative h-96">
        <img 
          src={listing.images[0].path} 
          alt={listing.title}
          class="w-full h-full object-cover"
        />
      </div>
    {/if}

    <!-- Listing Details -->
    <div class="p-6">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-3xl font-bold mb-2">{listing.title}</h1>
          <div class="flex items-center gap-4 text-sm text-gray-600 mb-4">
            <span class="flex items-center gap-1">
              <Icon icon="material-symbols:location-on" />
              {listing.location.name}
            </span>
            <span class="flex items-center gap-1">
              <Icon icon="material-symbols:category" />
              {listing.category.name}
            </span>
            <span class="flex items-center gap-1">
              <Icon icon="material-symbols:calendar-month" />
              {formatDate(listing.createdAt)}
            </span>
          </div>
        </div>
        <div class="text-2xl font-bold text-primary">
          ₹ {listing.price}
        </div>
      </div>

      <!-- Description -->
      <div class="mt-6">
        <h2 class="text-xl font-semibold mb-2">Description</h2>
        <p class="text-gray-700 whitespace-pre-line">{listing.description}</p>
      </div>

      <!-- Contact Information -->
      <div class="mt-6">
        <h2 class="text-xl font-semibold mb-2">Contact Information</h2>
        <div class="space-y-2">
          {#if listing.phone}
            <div class="flex items-center gap-2">
              <Icon icon="material-symbols:phone" />
              <a href="tel:{listing.phone}" class="text-primary hover:underline">
                {listing.phone}
              </a>
            </div>
          {/if}
          {#if listing.email}
            <div class="flex items-center gap-2">
              <Icon icon="material-symbols:mail" />
              <a href="mailto:{listing.email}" class="text-primary hover:underline">
                {listing.email}
              </a>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>