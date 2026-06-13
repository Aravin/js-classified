<script lang="ts">
  import { formatCurrency, formatDate, checkActiveAdsLimit } from '$lib/utils';
  import Icon from '@iconify/svelte';
  import { config } from '$lib/config';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ImageUpload from '$lib/components/ImageUpload.svelte';
  import type { ImageUploadResult } from '$lib/types';
  import { user, getAuthHeaders } from '$lib/auth/auth0';

  export let data;
  let listing: any = null;
  let isLoading = true;
  let error: string | null = null;
  let uploadedImages: ImageUploadResult[] = [];
  let imageUploadError: string | null = null;
  let publishError: string | null = null;
  let isPublishing = false;
  let isUploadingImages = false;

  onMount(async () => {
    const listingId = $page.url.searchParams.get('id');
    if (!listingId) {
      error = 'No listing ID provided';
      isLoading = false;
      return;
    }

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/${listingId}`, {
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
      });
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
    uploadedImages = uploadedImages.filter((img) => img.id + '' !== imageId);
    if (listing) {
      listing.images = uploadedImages;
    }
  }

  async function publishListing() {
    if (!listing) return;
    if (isPublishing) return;

    publishError = null;
    isPublishing = true;

    try {
      // Check active ads limit before publishing
      if ($user?.sub) {
        const limitCheck = await checkActiveAdsLimit($user.sub, listing.id);
        if (limitCheck.hasReachedLimit) {
          publishError = `You are allowed to have only ${limitCheck.activeLimit} active ad${limitCheck.activeLimit > 1 ? 's' : ''}. To add more ads, please contact us.`;
          return;
        }
      }

      const payload = {
        status: 'ACTIVE',
        images: uploadedImages.map((img, index) => ({
          path: img.path,
          thumbnailPath: img.thumbnailPath,
          order: index,
        })),
      };

      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/${listing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to publish listing');
      }

      // Navigate to the published listing
      await goto(`/list/${responseData.slug}`);
    } catch (err) {
      console.error('Error publishing listing:', err);
      publishError = err instanceof Error ? err.message : 'Failed to publish listing';
    } finally {
      isPublishing = false;
    }
  }

  function handleEdit() {
    if (listing?.id) {
      goto(`/my-ads/edit/${listing.id}`);
    } else {
      goto('/post-ad');
    }
  }
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
  {#if isLoading}
    <div class="flex min-h-[400px] items-center justify-center">
      <Icon icon="material-symbols:sync" class="h-8 w-8 animate-spin text-primary" />
    </div>
  {:else if error}
    <div class="rounded-lg bg-error/10 p-4">
      <div class="flex items-center gap-2 text-error">
        <Icon icon="material-symbols:error" class="h-6 w-6" />
        <p class="font-medium">{error}</p>
      </div>
    </div>
  {:else if listing}
    <!-- Preview Header -->
    <div class="mb-6 rounded-lg bg-primary/10 p-4">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <Icon icon="material-symbols:preview" class="h-6 w-6 text-primary" />
          <h2 class="text-lg font-semibold">Preview Your Listing</h2>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="btn btn-ghost flex-1 sm:flex-none"
            on:click={handleEdit}
            disabled={isPublishing || isUploadingImages}
          >
            <Icon icon="material-symbols:edit" class="mr-2 h-5 w-5" />
            Edit
          </button>
          <button
            class="btn btn-primary flex-1 sm:flex-none"
            on:click={publishListing}
            disabled={isPublishing || isUploadingImages}
          >
            {#if isPublishing}
              <Icon icon="material-symbols:sync" class="mr-2 h-5 w-5 animate-spin" />
              Publishing...
            {:else}
              <Icon icon="material-symbols:publish" class="mr-2 h-5 w-5" />
              Publish
            {/if}
          </button>
        </div>
      </div>
      {#if publishError}
        <div class="alert alert-error mt-4">
          <Icon icon="material-symbols:error" class="h-5 w-5" />
          <span>{publishError}</span>
        </div>
      {/if}
    </div>

    <!-- Image Upload Section -->
    <div class="mb-6 rounded-lg bg-white p-6 shadow-lg">
      <h3 class="mb-4 text-lg font-semibold">Add Images (Optional)</h3>
      <ImageUpload
        listingId={listing.id}
        maxFiles={3}
        bind:isUploading={isUploadingImages}
        on:upload={handleImageUpload}
        on:error={handleImageUploadError}
      />
      {#if imageUploadError}
        <div class="error-container mt-4">
          <div class="flex items-center gap-2 text-error">
            <Icon icon="material-symbols:error" class="h-5 w-5" />
            <span class="text-sm font-medium">{imageUploadError}</span>
          </div>
        </div>
      {/if}
      {#if uploadedImages.length > 0}
        <div class="mt-4 grid grid-cols-3 gap-4">
          {#each uploadedImages as image (image.id)}
            <div class="group relative">
              <img
                src={image.thumbnailPath || image.path}
                alt="Uploaded"
                class="aspect-square w-full rounded-lg object-cover"
              />
              {#if !isPublishing && !isUploadingImages}
                <button
                  type="button"
                  class="hover:bg-error-focus absolute right-2 top-2 rounded-full bg-error p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  on:click={() => handleImageDelete(image.id + '')}
                >
                  <Icon icon="material-symbols:delete" class="h-5 w-5" />
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="overflow-hidden rounded-lg bg-white shadow-lg">
      <!-- Listing Preview -->
      {#if uploadedImages.length > 0}
        <div class="relative h-96">
          <img
            src={uploadedImages[0].path}
            alt={listing.title}
            class="h-full w-full object-cover"
          />
        </div>
      {/if}

      <!-- Listing Details -->
      <div class="p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex-1 space-y-2">
            <h1 class="break-words text-2xl font-bold">{listing.title}</h1>
            <div class="flex flex-col gap-2 text-sm text-gray-500 sm:flex-row">
              <div class="flex items-center gap-1">
                <Icon icon="material-symbols:location-on" class="h-4 w-4" />
                <span>{listing.location.name}</span>
              </div>
              <div class="hidden text-gray-300 sm:block">•</div>
              <div class="flex items-center gap-1">
                <Icon icon="material-symbols:category" class="h-4 w-4" />
                <span>{listing.category.name}</span>
              </div>
              <div class="hidden text-gray-300 sm:block">•</div>
              <div class="flex items-center gap-1">
                <Icon icon="material-symbols:calendar-month" class="h-4 w-4" />
                <span>{formatDate(listing.createdAt)}</span>
              </div>
            </div>
          </div>
          <div class="whitespace-nowrap text-2xl font-bold text-primary">
            {formatCurrency(listing.price)}
          </div>
        </div>

        <!-- Description -->
        <div class="mt-6">
          <h2 class="mb-2 text-xl font-semibold">Description</h2>
          <p class="whitespace-pre-line text-gray-700">{listing.description}</p>
        </div>

        <!-- Contact Information -->
        <div class="mt-6">
          <h2 class="mb-4 text-xl font-semibold">Contact Information</h2>
          <div class="space-y-4">
            {#if listing.phone}
              <div class="flex items-center gap-2">
                <Icon icon="ic:baseline-phone" class="h-5 w-5 text-primary" />
                <span class="font-mono">{listing.phone}</span>
              </div>
            {/if}

            {#if listing.email}
              <div class="flex items-center gap-2">
                <Icon icon="material-symbols:mail" class="h-5 w-5 text-primary" />
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
