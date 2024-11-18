<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ImageUploadResult } from '$lib/types';
  import { config } from '$lib/config';
  import { browser } from '$app/environment';
  import { flip } from 'svelte/animate';
  import { dndzone } from 'svelte-dnd-action';
  import Icon from '@iconify/svelte';
  
  const dispatch = createEventDispatcher<{
    upload: { images: ImageUploadResult[] };
    error: { message: string };
  }>();
  
  export let listingId: number;
  export let maxFiles = 5;
  export let maxSize = 5 * 1024 * 1024; // 5MB
  
  let fileInput: HTMLInputElement;
  let uploadStates: Map<string, { progress: number, error: string | null }> = new Map();
  let preview: Array<{ id: string, src: string, file: File, uploading: boolean, error: string | null }> = [];
  let error: string | null = null;
  let showDeleteConfirm: string | null = null;  // Store ID of image to delete
  
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  function handleDndConsider(e: CustomEvent<{ items: typeof preview }>) {
    preview = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: typeof preview }>) {
    preview = e.detail.items;
    // Dispatch order change event if needed
  }
  
  function confirmDelete(id: string) {
    showDeleteConfirm = id;
  }
  
  function handleDelete(id: string) {
    preview = preview.filter(p => p.id !== id);
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
    Array.from(input.files).forEach(file => {
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
          preview = [...preview, { 
            id,
            src: result,
            file,
            uploading: false,
            error: null
          }];
        }
      };
      reader.readAsDataURL(file);
    });
    
    input.value = '';
  }
  
  async function uploadFile(item: typeof preview[0]) {
    item.uploading = true;
    item.error = null;
    
    try {
      const formData = new FormData();
      formData.append('image', item.file);
      formData.append('order', (preview.indexOf(item) + 1).toString());
      
      const apiUrl = `${config.api.baseUrl}/images/listings/${listingId}/images`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Upload failed with status ${response.status}` }));
        throw new Error(errorData.message || 'Upload failed');
      }
      
      const result = await response.json();
      if (result.success) {
        dispatch('upload', { images: [result.images[0]] });
        preview = preview.filter(p => p.id !== item.id);
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
    preview.filter(item => !item.uploading && !item.error).forEach(uploadFile);
  }
</script>

<div class="upload-container">
  {#if preview.length < maxFiles}
    <div
      class="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-primary transition-colors"
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
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-focus transition-colors"
          on:click={() => fileInput.click()}
          disabled={preview.length >= maxFiles}
        >
          <Icon icon="material-symbols:upload" class="w-5 h-5" />
          <span>Choose Images</span>
        </button>
        <p class="text-sm text-gray-600 mt-2">
          Drop your images here or click to browse
        </p>
        <p class="text-xs text-gray-500 mt-1">
          JPG, PNG or WebP, {maxFiles - preview.length} more {maxFiles - preview.length === 1 ? 'image' : 'images'} allowed (up to 5MB each)
        </p>
      </div>
    </div>
  {/if}
  
  {#if error}
    <p class="text-error text-sm mt-2">{error}</p>
  {/if}
  
  {#if preview.length}
    <div
      class="grid grid-cols-3 gap-4 {preview.length < maxFiles ? 'mt-4' : 'mt-0'}"
      use:dndzone={{items: preview}}
      on:consider={handleDndConsider}
      on:finalize={handleDndFinalize}
    >
      {#each preview as item (item.id)}
        <div
          class="relative group bg-white rounded-lg shadow-md overflow-hidden"
          animate:flip
        >
          <img
            src={item.src}
            alt="Preview"
            class="w-full aspect-square object-cover"
            class:opacity-50={item.uploading || showDeleteConfirm === item.id}
          />
          
          {#if item.uploading}
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          {:else if item.error}
            <div class="absolute inset-0 flex items-center justify-center bg-error/10">
              <div class="text-error text-center p-2">
                <Icon icon="material-symbols:error" class="w-6 h-6 mx-auto" />
                <p class="text-xs mt-1">Upload failed</p>
              </div>
            </div>
          {:else if showDeleteConfirm === item.id}
            <div class="absolute inset-0 flex items-center justify-center bg-black/50">
              <div class="text-center p-4">
                <p class="text-white text-sm mb-2">Delete this image?</p>
                <div class="flex gap-2 justify-center">
                  <button
                    type="button"
                    class="px-3 py-1 bg-error text-white rounded hover:bg-error-focus"
                    on:click={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                    on:click={() => showDeleteConfirm = null}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          {/if}
          
          <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {#if item.error}
              <button
                type="button"
                class="p-1 rounded-full bg-primary text-white hover:bg-primary-focus"
                on:click={() => uploadFile(item)}
              >
                <Icon icon="material-symbols:refresh" class="w-5 h-5" />
              </button>
            {/if}
            <button
              type="button"
              class="p-1 rounded-full bg-error text-white hover:bg-error-focus"
              on:click={() => confirmDelete(item.id)}
            >
              <Icon icon="material-symbols:delete" class="w-5 h-5" />
            </button>
          </div>
          
          <div class="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-xs">
            Image {preview.indexOf(item) + 1} of {preview.length}
          </div>
        </div>
      {/each}
    </div>
    
    <button
      type="button"
      class="w-full mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-focus disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      on:click={handleUpload}
      disabled={preview.every(item => item.uploading || item.error)}
    >
      Upload {preview.length} {preview.length === 1 ? 'Image' : 'Images'}
    </button>
  {/if}
</div>

<style lang="postcss">
  .upload-container {
    @apply w-full max-w-2xl mx-auto;
  }
  
  :global(.dndzone.active) {
    @apply border-primary;
  }
</style>