<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ImageUploadResult } from '$lib/types';
  import { config } from '$lib/config';
  import { browser } from '$app/environment';
  import { flip } from 'svelte/animate';
  import { dndzone } from 'svelte-dnd-action';
  import Icon from '@iconify/svelte';
  import { getAuthHeaders } from '$lib/auth/auth0';

  const dispatch = createEventDispatcher<{
    upload: { images: ImageUploadResult[] };
    error: { message: string };
  }>();

  export let listingId: number;
  export let maxFiles = 5;
  export let maxSize = 5 * 1024 * 1024; // 5MB
  export let isUploading = false;

  $: isUploading = preview.some((item) => item.uploading);

  let fileInput: HTMLInputElement;
  let uploadStates: Map<string, { progress: number; error: string | null }> = new Map();
  let preview: Array<{
    id: string;
    src: string;
    file: File;
    uploading: boolean;
    error: string | null;
    order: number | null;
  }> = [];
  let error: string | null = null;
  let showDeleteConfirm: string | null = null; // Store ID of image to delete

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  function handleDndConsider(e: CustomEvent<{ items: typeof preview }>) {
    preview = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: typeof preview }>) {
    preview = e.detail.items;
    // Update order of all images after drag and drop
    preview = preview.map((item, index) => ({
      ...item,
      order: index + 1,
    }));
  }

  function confirmDelete(id: string) {
    showDeleteConfirm = id;
  }

  function handleDelete(id: string) {
    preview = preview.filter((p) => p.id !== id);
    showDeleteConfirm = null;
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    error = null;

    // Validate total number of files
    if (input.files.length + preview.length > maxFiles) {
      error = `Maximum ${maxFiles} images allowed`;
      input.value = '';
      return;
    }

    // Process each file
    Array.from(input.files).forEach((file) => {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        error = 'Only JPG, PNG and WebP images are allowed';
        return;
      }

      // Validate file size
      if (file.size > maxSize) {
        error = 'Each image must be less than 5MB';
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          const id = crypto.randomUUID();
          preview = [
            ...preview,
            {
              id,
              src: result,
              file,
              uploading: false,
              error: null,
              order: null,
            },
          ];
        }
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  async function uploadFile(item: (typeof preview)[0]) {
    item.uploading = true;
    item.error = null;

    try {
      const formData = new FormData();
      formData.append('image', item.file);

      // Get current order of all images
      const currentOrder =
        preview.map((p, index) => ({ id: p.id, order: index + 1 })).find((p) => p.id === item.id)
          ?.order || 1;

      formData.append('order', currentOrder.toString());

      const apiUrl = `${config.api.baseUrl}/images/listings/${listingId}/images`;
      const authHeaders = await getAuthHeaders();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Upload failed with status ${response.status}` }));
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      if (result.success) {
        dispatch('upload', { images: [result.images[0]] });
        preview = preview.filter((p) => p.id !== item.id);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      item.error = err instanceof Error ? err.message : 'Upload failed';
      dispatch('error', { message: item.error });
    } finally {
      item.uploading = false;
    }
  }

  function handleUpload() {
    preview.filter((item) => !item.uploading && !item.error).forEach(uploadFile);
  }
</script>

<div class="upload-container">
  {#if preview.length < maxFiles}
    <div
      class="rounded-lg border-2 border-dashed border-gray-300 p-6 transition-colors hover:border-primary"
      class:border-error={error}
    >
      <input
        bind:this={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        on:change={handleFileSelect}
        class="hidden"
      />

      <div class="text-center">
        <button
          type="button"
          class="hover:bg-primary-focus inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          on:click={() => fileInput.click()}
          disabled={preview.length >= maxFiles || isUploading}
        >
          <Icon icon="material-symbols:upload" class="h-5 w-5" />
          <span>Choose Images</span>
        </button>
        <p class="mt-2 text-sm text-gray-600">Drop your images here or click to browse</p>
        <p class="mt-1 text-xs text-gray-500">
          JPG, PNG or WebP, {maxFiles - preview.length} more {maxFiles - preview.length === 1
            ? 'image'
            : 'images'} allowed (up to 5MB each)
        </p>
      </div>
    </div>
  {/if}

  {#if error}
    <p class="mt-2 text-sm text-error">{error}</p>
  {/if}

  {#if preview.length}
    <div
      class="grid grid-cols-3 gap-4 {preview.length < maxFiles ? 'mt-4' : 'mt-0'}"
      use:dndzone={{ items: preview }}
      on:consider={handleDndConsider}
      on:finalize={handleDndFinalize}
    >
      {#each preview as item (item.id)}
        <div class="group relative overflow-hidden rounded-lg bg-white shadow-md" animate:flip>
          <img
            src={item.src}
            alt="Preview"
            class="aspect-square w-full object-cover"
            class:opacity-50={item.uploading || showDeleteConfirm === item.id}
          />

          {#if item.uploading}
            <div class="absolute inset-0 flex items-center justify-center">
              <div
                class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
              ></div>
            </div>
          {:else if item.error}
            <div class="absolute inset-0 flex items-center justify-center bg-error/10">
              <div class="p-2 text-center text-error">
                <Icon icon="material-symbols:error" class="mx-auto h-6 w-6" />
                <p class="mt-1 text-xs">Upload failed</p>
              </div>
            </div>
          {:else if showDeleteConfirm === item.id}
            <div class="absolute inset-0 flex items-center justify-center bg-black/50">
              <div class="p-4 text-center">
                <p class="mb-2 text-sm text-white">Delete this image?</p>
                <div class="flex justify-center gap-2">
                  <button
                    type="button"
                    class="hover:bg-error-focus rounded bg-error px-3 py-1 text-white"
                    on:click={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    class="rounded bg-gray-600 px-3 py-1 text-white hover:bg-gray-700"
                    on:click={() => (showDeleteConfirm = null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          {/if}

          {#if !item.uploading}
            <div
              class="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100"
            >
              {#if item.error}
                <button
                  type="button"
                  class="hover:bg-primary-focus rounded-full bg-primary p-1 text-white"
                  on:click={() => uploadFile(item)}
                >
                  <Icon icon="material-symbols:refresh" class="h-5 w-5" />
                </button>
              {/if}
              <button
                type="button"
                class="hover:bg-error-focus rounded-full bg-error p-1 text-white"
                on:click={() => confirmDelete(item.id)}
              >
                <Icon icon="material-symbols:delete" class="h-5 w-5" />
              </button>
            </div>
          {/if}

          <div class="absolute bottom-0 left-0 right-0 bg-black/50 p-2 text-xs text-white">
            Image {preview.indexOf(item) + 1} of {preview.length}
          </div>
        </div>
      {/each}
    </div>

    <button
      type="button"
      class="hover:bg-primary-focus mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      on:click={handleUpload}
      disabled={isUploading || preview.every((item) => item.error) || preview.length === 0}
    >
      {#if isUploading}
        <Icon icon="material-symbols:sync" class="h-5 w-5 animate-spin" />
        <span>Uploading...</span>
      {:else}
        <Icon icon="material-symbols:upload" class="h-5 w-5" />
        <span>Upload {preview.length} {preview.length === 1 ? 'Image' : 'Images'}</span>
      {/if}
    </button>
  {/if}
</div>

<style lang="postcss">
  .upload-container {
    @apply mx-auto w-full max-w-2xl;
  }

  :global(.dndzone.active) {
    @apply border-primary;
  }
</style>
