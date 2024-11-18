<script lang="ts">
  import { formatCurrency, formatDate } from '$lib/utils';
  import Icon from '@iconify/svelte';
  import { config } from '$lib/config';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ImageUpload from '$lib/components/ImageUpload.svelte';
  import type { ImageUploadResult } from '$lib/types';

  export let data;
  let listing: any = null;
  let isLoading = true;
  let error: string | null = null;
  let uploadedImages: ImageUploadResult[] = [];
  let imageUploadError: string | null = null;

  onMount(async () => {
    const listingId = $page.url.searchParams.get('id');
    if (!listingId) {
      error = 'No listing ID provided';
      isLoading = false;
      return;
    }

    try {
      const response = await fetch(`${config.api.baseUrl}/listings/${listingId}`);
      if (!response.ok) throw new Error('Failed to fetch listing');
      
      listing = await response.json();
      if (listing.images) {
        uploadedImages = listing.images;
      }
    } catch (err) {
      error = 'Failed to load listing preview';
      console.error('Error loading preview:', err);
    } finally {
      isLoading = false;
    }
  });

  function handleImageUpload(event: CustomEvent<{ images: ImageUploadResult[] }>) {
    uploadedImages = [...uploadedImages, ...event.detail.images];
    imageUploadError = null;
    if (listing) {
      listing.images = uploadedImages;
    }
  }

  function handleImageUploadError(event: CustomEvent<{ message: string }>) {
    imageUploadError = event.detail.message;
  }

  function handleImageDelete(imageId: string) {
    uploadedImages = uploadedImages.filter(img => img.id + '' !== imageId);
    if (listing) {
      listing.images = uploadedImages;
    }
  }

  async function publishListing() {
    if (!listing) return;
    
    try {
      const response = await fetch(`${config.api.baseUrl}/listings/${listing.id}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          images: uploadedImages.map((img, index) => ({
            path: img.path,
            thumbnailPath: img.thumbnailPath,
            order: index
          }))
        })
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to publish listing');
      }

      // Navigate to the published listing
      await goto(`/list/${responseData.slug}`);
    } catch (err) {
      error = 'Failed to publish listing';
      console.error('Error publishing:', err);
    }
  }

  function handleEdit() {
    goto('/post-ad');
  }
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
  {#if isLoading}
    <div class="flex justify-center items-center min-h-[400px]">
      <Icon icon="material-symbols:sync" class="w-8 h-8 animate-spin text-primary" />
    </div>
  {:else if error}
    <div class="bg-error/10 p-4 rounded-lg">
      <div class="flex items-center gap-2 text-error">
        <Icon icon="material-symbols:error" class="w-6 h-6" />
        <p class="font-medium">{error}</p>
      </div>
    </div>
  {:else if listing}
    <!-- Preview Header -->
    <div class="bg-primary/10 p-4 rounded-lg mb-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Icon icon="material-symbols:preview" class="w-6 h-6 text-primary" />
          <h2 class="text-lg font-semibold">Preview Your Listing</h2>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost" on:click={handleEdit}>
            <Icon icon="material-symbols:edit" class="w-5 h-5 mr-2" />
            Edit
          </button>
          <button class="btn btn-primary" on:click={publishListing}>
            <Icon icon="material-symbols:publish" class="w-5 h-5 mr-2" />
            Publish
          </button>
        </div>
      </div>
    </div>

    <!-- Image Upload Section -->
    <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 class="text-lg font-semibold mb-4">Add Images (Optional)</h3>
      <ImageUpload
        listingId={listing.id}
        maxFiles={3}
        on:upload={handleImageUpload}
        on:error={handleImageUploadError}
      />
      {#if imageUploadError}
        <div class="error-container mt-4">
          <div class="flex items-center gap-2 text-error">
            <Icon icon="material-symbols:error" class="w-5 h-5" />
            <span class="text-sm font-medium">{imageUploadError}</span>
          </div>
        </div>
      {/if}
      {#if uploadedImages.length > 0}
        <div class="grid grid-cols-3 gap-4 mt-4">
          {#each uploadedImages as image (image.id)}
            <div class="relative group">
              <img
                src={image.thumbnailPath || image.path}
                alt="Uploaded"
                class="w-full aspect-square object-cover rounded-lg"
              />
              <button
                type="button"
                class="absolute top-2 right-2 bg-error hover:bg-error-focus text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                on:click={() => handleImageDelete(image.id + '')}
              >
                <Icon icon="material-symbols:delete" class="w-5 h-5" />
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
      <!-- Listing Preview -->
      {#if uploadedImages.length > 0}
        <div class="relative h-96">
          <img 
            src={uploadedImages[0].path} 
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
            {#if listing.phone}
              <div class="flex items-center gap-2">
                <Icon icon="ic:baseline-phone" class="w-5 h-5 text-primary" />
                <span class="font-mono">{listing.phone}</span>
              </div>
            {/if}
            
            {#if listing.email}
              <div class="flex items-center gap-2">
                <Icon icon="material-symbols:mail" class="w-5 h-5 text-primary" />
                <span class="font-mono">{listing.email}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.preview-header) {
    background-color: rgba(var(--color-primary), 0.1);
  }
</style>