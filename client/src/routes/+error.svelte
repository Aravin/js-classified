<script lang="ts">
  import { page } from '$app/stores';
  import Icon from '@iconify/svelte';
</script>

<div class="min-h-screen pt-24 px-4 md:px-8">
  <div class="container mx-auto">
    <div class="max-w-2xl mx-auto text-center bg-base-100 shadow-xl rounded-xl p-8 md:p-12">
      {#if $page.status === 404}
        <Icon icon="material-symbols:error-outline" font-size="64" class="mx-auto text-error mb-8" />
        <h1 class="text-4xl md:text-5xl font-bold mb-4">Page Not Found</h1>
        <p class="text-lg text-base-content/70 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
      {:else if $page.status === 500}
        <Icon icon="material-symbols:warning-outline" font-size="64" class="mx-auto text-error mb-8" />
        <h1 class="text-4xl md:text-5xl font-bold mb-4">Server Error</h1>
        <p class="text-lg text-base-content/70 mb-8">
          Something went wrong on our end. Please try again later.
        </p>
      {:else}
        <Icon icon="material-symbols:info-outline" font-size="64" class="mx-auto text-error mb-8" />
        <h1 class="text-4xl md:text-5xl font-bold mb-4">Oops!</h1>
        <p class="text-lg text-base-content/70 mb-6">
          {$page.error?.message || 'Something went wrong'}
        </p>
        <p class="text-base text-base-content/50">
          Error {$page.status}
        </p>
      {/if}
      
      <div class="mt-12">
        <a href="/" class="btn btn-primary btn-lg">
          <Icon icon="material-symbols:home" class="w-6 h-6 mr-2" />
          Go Home
        </a>
      </div>
    </div>
  </div>
</div>