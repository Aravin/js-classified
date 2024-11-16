<script lang="ts">
  import { formatDate } from '$lib/utils';
  import Icon from '@iconify/svelte';
  import { config } from '$lib/config';

  export let data;
  const { listing } = data;

  let contactInfo = {
    phone: null,
    email: null
  };
  let isLoading = false;
  let error: string | null = null;
  let cachedContactInfo = {
    phone: null,
    email: null
  };

  const LISTING_EXPIRY_DAYS = config.listing.expiryDays;

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat(
      config.currency.locale,
      config.currency.options
    ).format(amount);
  }

  async function fetchContactInfo(type: 'phone' | 'email' | 'both') {
    isLoading = true;
    error = null;
    try {
      // Only fetch if we don't have the data cached
      if (!cachedContactInfo.phone && !cachedContactInfo.email) {
        const response = await fetch(`${config.api.baseUrl}/listings/${listing.id}/contact`);
        if (!response.ok) throw new Error('Failed to fetch contact information');
        const data = await response.json();
        cachedContactInfo = data.contactInfo;
      }

      // Show only requested contact info
      if (type === 'phone') {
        contactInfo.phone = cachedContactInfo.phone;
      } else if (type === 'email') {
        contactInfo.email = cachedContactInfo.email;
      } else {
        contactInfo = { ...cachedContactInfo };
      }
    } catch (err) {
      error = 'Failed to load contact information. Please try again.';
      console.error('Error fetching contact info:', err);
    } finally {
      isLoading = false;
    }
  }

  function formatPhoneNumber(phone: string): string {
    // Format: +91 XXXXX-XXXXX
    return `+91 ${phone.slice(0, 5)}-${phone.slice(5)}`;
  }

  function getDaysLeft(createdAt: string): number {
    const created = new Date(createdAt);
    const expiryDate = new Date(created.getTime() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  }
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
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-2 flex-1">
          <h1 class="text-2xl font-bold break-words">{listing.title}</h1>
          <div class="flex flex-col sm:flex-row gap-2 text-sm text-gray-500">
            <div class="flex items-center gap-1">
              <Icon icon="material-symbols:location-on" class="w-4 h-4" />
              <span>{listing.location.name}</span>
            </div>
            <div class="hidden sm:block text-gray-300">•</div>
            <div class="flex items-center gap-1">
              <Icon icon="material-symbols:category" class="w-4 h-4" />
              <span>{listing.category.name}</span>
            </div>
            <div class="hidden sm:block text-gray-300">•</div>
            <div class="flex items-center gap-1">
              <Icon icon="material-symbols:calendar-month" class="w-4 h-4" />
              <span>{formatDate(listing.createdAt)}</span>
            </div>
            <div class="hidden sm:block text-gray-300">•</div>
            <div class="flex items-center gap-1">
              <Icon icon="material-symbols:timer-outline" class="w-4 h-4" />
              <span>{getDaysLeft(listing.createdAt)} days left</span>
            </div>
          </div>
        </div>
        <div class="text-2xl font-bold text-primary whitespace-nowrap">
          {formatCurrency(listing.price)}
        </div>
      </div>

      <!-- Description -->
      <div class="mt-6">
        <h2 class="text-xl font-semibold mb-2">Description</h2>
        <p class="text-gray-700 whitespace-pre-line">{listing.description}</p>
      </div>

      <!-- Contact Information -->
      <div class="mt-6">
        <h2 class="text-xl font-semibold mb-4">Contact Information</h2>
        <div class="space-y-4">
          {#if listing.hasPhone}
            <div class="flex items-center gap-1 w-[250px]">
              <Icon icon="ic:baseline-phone" class="w-5 h-5 text-primary" />
              <span class="font-mono">
                {#if contactInfo.phone}
                  {contactInfo.phone}
                {:else}
                  *****-*****
                {/if}
              </span>
              {#if !contactInfo.phone}
                <button
                  class="btn btn-sm btn-ghost"
                  on:click={() => fetchContactInfo('phone')}
                  disabled={isLoading}
                >
                  {#if isLoading}
                    <Icon icon="material-symbols:sync-outline" class="animate-spin w-5 h-5" />
                  {:else}
                    <Icon icon="material-symbols:visibility" class="w-5 h-5" />
                  {/if}
                </button>
              {/if}
            </div>
          {/if}
          
          {#if listing.hasEmail}
            <div class="flex items-center gap-1 w-[250px]">
              <Icon icon="material-symbols:mail" class="w-5 h-5 text-primary" />
              <span class="font-mono">
                {#if contactInfo.email}
                  {contactInfo.email}
                {:else}
                  ***@***.***
                {/if}
              </span>
              {#if !contactInfo.email}
                <button
                  class="btn btn-sm btn-ghost"
                  on:click={() => fetchContactInfo('email')}
                  disabled={isLoading}
                >
                  {#if isLoading}
                    <Icon icon="material-symbols:sync-outline" class="animate-spin w-5 h-5" />
                  {:else}
                    <Icon icon="material-symbols:visibility" class="w-5 h-5" />
                  {/if}
                </button>
              {/if}
            </div>
          {/if}

          {#if error}
            <div class="text-error text-sm mt-2 flex items-center gap-1">
              <Icon icon="material-symbols:error" class="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>