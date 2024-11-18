<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ImageUploadResult } from '$lib/types';
  import { config } from '$lib/config';
  import { browser } from '$app/environment';
  
  const dispatch = createEventDispatcher<{
    upload: { images: ImageUploadResult[] };
    error: { message: string };
  }>();
  
  export let listingId: number;
  export let maxFiles = 5;
  export let maxSize = 5 * 1024 * 1024; // 5MB
  
  let fileInput: HTMLInputElement;
  let uploading = false;
  let preview: string[] = [];
  let files: FileList | null = null;
  let error: string | null = null;
  
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    files = input.files;
    preview = [];
    error = null;
    
    // Validate number of files
    if (files.length > maxFiles) {
      error = `Maximum ${maxFiles} images allowed`;
      files = null;
      if (fileInput) fileInput.value = '';
      return;
    }
    
    // Validate each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        error = 'Only JPG, PNG and WebP images are allowed';
        files = null;
        if (fileInput) fileInput.value = '';
        return;
      }
      
      // Check file size
      if (file.size > maxSize) {
        error = 'Each image must be less than 5MB';
        files = null;
        if (fileInput) fileInput.value = '';
        return;
      }
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          preview = [...preview, result];
        }
      };
      reader.readAsDataURL(file);
    }
  }
  
  async function handleUpload() {
    if (!files || files.length === 0) return;
    
    uploading = true;
    error = null;
    
    try {
      const formData = new FormData();
      Array.from(files).forEach((file, index) => {
        formData.append('image', file);
        formData.append('order', (index + 1).toString());
      });
      
      const apiUrl = `${config.api.baseUrl}/images/listings/${listingId}/images`;
      console.log('Sending request to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || `Upload failed with status ${response.status}`;
        } catch (e) {
          errorMessage = `Upload failed with status ${response.status}`;
        }
        console.error('Upload error:', errorMessage);
        throw new Error(errorMessage);
      }
      
      let result;
      try {
        result = await response.json();
        console.log('Upload result:', result);
      } catch (e) {
        console.error('Failed to parse response:', e);
        throw new Error('Invalid response from server');
      }

      if (result.success) {
        dispatch('upload', { images: result.images });
        preview = [];
        if (fileInput) fileInput.value = '';
        files = null;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      const error = err as Error;
      if (!navigator.onLine) {
        dispatch('error', { message: 'No internet connection. Please check your network and try again.' });
      } else {
        dispatch('error', { message: error.message || 'Failed to upload images. Please try again.' });
      }
    } finally {
      uploading = false;
    }
  }
</script>

<div class="upload-container">
  <input
    bind:this={fileInput}
    type="file"
    accept="image/jpeg,image/png,image/webp"
    multiple
    on:change={handleFileSelect}
    class="file-input"
  />
  
  {#if error}
    <p class="error">{error}</p>
  {/if}
  
  {#if preview.length}
    <div class="preview-grid">
      {#each preview as src}
        <img src={src} alt="Preview" class="preview-image" />
      {/each}
    </div>
    
    <button
      on:click={handleUpload}
      disabled={uploading}
      class="upload-button"
    >
      {uploading ? 'Uploading...' : 'Upload Images'}
    </button>
  {/if}
</div>

<style>
  .upload-container {
    width: 100%;
    max-width: 600px;
    margin: 1rem 0;
  }
  
  .preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
  }
  
  .preview-image {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 0.5rem;
  }
  
  .upload-button {
    width: 100%;
    padding: 0.5rem;
    margin-top: 1rem;
  }
  
  .file-input {
    width: 100%;
    padding: 0.5rem;
  }
  
  .error {
    color: red;
    margin: 0.5rem 0;
  }
</style>