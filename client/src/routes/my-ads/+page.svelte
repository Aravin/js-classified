<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/config';
  import { authState } from '$lib/auth/auth0';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';
  import { formatCurrency, formatDate } from '$lib/utils';
  import { browser } from '$app/environment';

  interface Listing {
    id: number;
    title: string;
    slug: string;
    description: string;
    price: string;
    status: string;
    categoryId: number;
    locationId: number;
    userId: number;
    createdAt: string;
    updatedAt: string;
    category: {
      id: number;
      name: string;
      slug: string;
      parent_category_id: number;
    };
    location: {
      id: number;
      name: string;
      dist: string;
      state: string;
    };
    images: {
      id: number;
      path: string;
      thumbnailPath: string;
      order: number;
    }[];
    hasEmail: boolean;
    hasPhone: boolean;
  }

  let listings: Listing[] = [];
  let isLoading = true;
  let error: string | null = null;
  let listingToDelete: Listing | null = null;
  let listingToUpdateStatus: { listing: Listing; newStatus: 'ACTIVE' | 'DRAFT' } | null = null;

  // Store current page as redirect destination before redirecting to login
  function redirectToLogin() {
    if (browser) {
      sessionStorage.setItem('redirectTo', '/my-ads');
      goto('/login');
    }
  }

  async function handleDelete() {
    if (!listingToDelete) return;
    const idToDelete = listingToDelete.id;

    try {
      const response = await fetch(`${config.api.baseUrl}/listings/${idToDelete}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete listing');
      }

      // Remove the deleted listing from the list
      listings = listings.filter(listing => listing.id !== idToDelete);
      listingToDelete = null; // Reset after successful deletion
      
      // Close the modal
      const modal = document.getElementById('delete-modal') as HTMLDialogElement;
      modal?.close();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete listing';
      console.error('Error deleting listing:', e);
    }
  }

  function showDeleteConfirmation(listing: Listing) {
    listingToDelete = listing;
    const modal = document.getElementById('delete-modal') as HTMLDialogElement;
    modal?.showModal();
  }

  async function handleStatusUpdate() {
    if (!listingToUpdateStatus) return;
    const { listing, newStatus } = listingToUpdateStatus;

    try {
      const response = await fetch(`${config.api.baseUrl}/listings/${listing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Update the listing status in the UI
      listings = listings.map(l => 
        l.id === listing.id 
          ? { ...l, status: newStatus }
          : l
      );

      // Close the modal and reset
      listingToUpdateStatus = null;
      const modal = document.getElementById('status-modal') as HTMLDialogElement;
      modal?.close();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to update status';
      console.error('Error updating status:', e);
    }
  }

  function showStatusConfirmation(listing: Listing, newStatus: 'ACTIVE' | 'DRAFT') {
    listingToUpdateStatus = { listing, newStatus };
    const modal = document.getElementById('status-modal') as HTMLDialogElement;
    modal?.showModal();
  }

  $: if (!$authState.isInitializing && !$authState.isAuthenticated) {
    redirectToLogin();
  }

  $: if (!$authState.isInitializing && $authState.isAuthenticated && $authState.user) {
    loadListings();
  }

  async function loadListings() {
    if (!$authState.user?.sub) return;

    try {
      const response = await fetch(`${config.api.baseUrl}/listings/user/${$authState.user.sub}`);
      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }
      const data = await response.json();
      listings = data.listings;
      console.log('Fetched listings:', listings);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load listings';
      console.error('Error:', error);
    } finally {
      isLoading = false;
    }
  }

  function getListingImage(listing: Listing): string {
    console.log('Getting image for listing:', listing.id, listing.images);
    if (listing.images && listing.images.length > 0) {
      return listing.images[0].thumbnailPath;
    }
    return 'https://placehold.co/300x300?text=No+Image';
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex items-center justify-between mb-8">
    <h1 class="text-2xl font-bold">My Ads</h1>
    <a href="/post-ad" class="btn btn-primary btn-sm normal-case gap-2">
      <Icon icon="material-symbols:add" class="w-5 h-5" />
      Post New Ad
    </a>
  </div>

  {#if isLoading}
    <div class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" class="w-6 h-6" />
      <span>{error}</span>
    </div>
  {:else if listings.length === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📭</div>
      <h3 class="text-xl font-medium mb-2">No Ads Yet</h3>
      <p class="text-base-content/60 mb-6">Start selling by posting your first ad!</p>
      <a href="/post-ad" class="btn btn-primary normal-case gap-2">
        <Icon icon="material-symbols:add" class="w-5 h-5" />
        Post Your First Ad
      </a>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each listings as listing (listing.id)}
        <div class="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <figure class="relative pt-[75%] bg-base-200">
            <img
              src={getListingImage(listing)}
              alt={listing.title}
              class="absolute inset-0 w-full h-full object-cover"
              on:error={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.src = 'https://placehold.co/300x300?text=No+Image';
              }}
            />
            <div class="absolute top-2 right-2">
              <span class="badge badge-{listing.status === 'ACTIVE' ? 'success' : 'warning'} badge-sm">
                {listing.status}
              </span>
            </div>
          </figure>
          <div class="card-body">
            <h2 class="card-title text-lg">{listing.title}</h2>
            <p class="text-2xl font-bold text-primary">{formatCurrency(Number(listing.price))}</p>
            <div class="flex flex-col gap-1 text-sm text-base-content/70">
              <div class="flex items-center gap-1">
                <Icon icon="material-symbols:location-on" class="w-4 h-4" />
                <span>{listing.location.name}</span>
              </div>
              <div class="flex items-center gap-1">
                <Icon icon="material-symbols:category" class="w-4 h-4" />
                <span>{listing.category.name}</span>
              </div>
              <div class="flex items-center gap-1">
                <Icon icon="material-symbols:calendar-month" class="w-4 h-4" />
                <span>{formatDate(listing.createdAt)}</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-4">
              <div class="col-span-1">
                <a 
                  href="/list/{listing.slug}" 
                  class="btn btn-sm btn-primary gap-1 w-full"
                >
                  <Icon icon="material-symbols:visibility" class="w-4 h-4" />
                  View
                </a>
              </div>
              <div class="col-span-1">
                <a 
                  href="/my-ads/edit/{listing.id}" 
                  class="btn btn-sm btn-info gap-1 w-full"
                >
                  <Icon icon="material-symbols:edit" class="w-4 h-4" />
                  Edit
                </a>
              </div>
              <div class="col-span-1">
                <button 
                  class="btn btn-sm btn-{listing.status === 'ACTIVE' ? 'warning' : 'success'} btn-outline gap-1 w-full"
                  on:click={() => showStatusConfirmation(listing, listing.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE')}
                >
                  <Icon icon="material-symbols:{listing.status === 'ACTIVE' ? 'pause' : 'play-arrow'}" class="w-4 h-4" />
                  {listing.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                </button>
              </div>
              <div class="col-span-1">
                <button 
                  class="btn btn-sm btn-error btn-outline gap-1 w-full"
                  on:click={() => showDeleteConfirmation(listing)}
                >
                  <Icon icon="material-symbols:delete" class="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<dialog id="delete-modal" class="modal modal-bottom sm:modal-middle">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Confirm Deletion</h3>
    <p class="py-4">
      Are you sure you want to delete "{listingToDelete?.title}"? This action cannot be undone.
    </p>
    <div class="modal-action">
      <form method="dialog">
        <div class="flex gap-2">
          <button class="btn">Cancel</button>
          <button 
            class="btn btn-error" 
            on:click|preventDefault={handleDelete}
          >
            Delete
          </button>
        </div>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>

<!-- Status Update Confirmation Modal -->
<dialog id="status-modal" class="modal modal-bottom sm:modal-middle">
  <div class="modal-box">
    <h3 class="font-bold text-lg">Confirm Status Change</h3>
    <p class="py-4">
      {#if listingToUpdateStatus}
        Are you sure you want to 
        {listingToUpdateStatus.newStatus === 'DRAFT' ? 'pause' : 'activate'} 
        "{listingToUpdateStatus.listing.title}"?
      {/if}
    </p>
    <div class="modal-action">
      <form method="dialog">
        <div class="flex gap-2">
          <button class="btn">Cancel</button>
          <button 
            class="btn btn-{listingToUpdateStatus?.newStatus === 'DRAFT' ? 'warning' : 'success'}" 
            on:click|preventDefault={handleStatusUpdate}
          >
            {listingToUpdateStatus?.newStatus === 'DRAFT' ? 'Pause' : 'Activate'}
          </button>
        </div>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>