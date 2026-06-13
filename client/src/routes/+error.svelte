<script lang="ts">
  import { page } from '$app/stores';
  import Icon from '@iconify/svelte';
</script>

<div class="min-h-screen px-4 pt-24 md:px-8">
  <div class="container mx-auto">
    <div class="mx-auto max-w-2xl rounded-xl bg-base-100 p-8 text-center shadow-xl md:p-12">
      {#if $page.status === 404}
        <Icon
          icon="material-symbols:error-outline"
          font-size="64"
          class="mx-auto mb-8 text-error"
        />
        <h1 class="mb-4 text-4xl font-bold md:text-5xl">Page Not Found</h1>
        <p class="mb-8 text-lg text-base-content/70">
          The page you're looking for doesn't exist or has been moved.
        </p>
      {:else if $page.status === 500}
        <Icon
          icon="material-symbols:warning-outline"
          font-size="64"
          class="mx-auto mb-8 text-error"
        />
        <h1 class="mb-4 text-4xl font-bold md:text-5xl">Server Error</h1>
        <p class="mb-8 text-lg text-base-content/70">
          Something went wrong on our end. Please try again later.
        </p>
      {:else}
        <Icon icon="material-symbols:info-outline" font-size="64" class="mx-auto mb-8 text-error" />
        <h1 class="mb-4 text-4xl font-bold md:text-5xl">Oops!</h1>
        <p class="mb-6 text-lg text-base-content/70">
          {$page.error?.message || 'Something went wrong'}
        </p>
        <p class="text-base text-base-content/50">
          Error {$page.status}
        </p>
      {/if}

      <div class="mt-12">
        <a href="/" class="btn btn-primary btn-lg">
          <Icon icon="material-symbols:home" class="mr-2 h-6 w-6" />
          Go Home
        </a>
      </div>
    </div>
  </div>
</div>
