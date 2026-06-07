<script lang="ts">
  import { onMount } from 'svelte';
  import { config } from '$lib/config';
  import { authState, getAuthHeaders } from '$lib/auth/auth0';
  import { goto } from '$app/navigation';
  import Icon from '@iconify/svelte';
  import { formatCurrency, formatDate, checkActiveAdsLimit } from '$lib/utils';
  import { browser } from '$app/environment';
  import { fade, scale } from 'svelte/transition';
  import { elasticOut } from 'svelte/easing';
  import { categories } from '$lib/categories/categories';
  import { locations } from '$lib/locations';
  import SortButtons from '$lib/components/SortButtons.svelte';

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
  let allListings: Listing[] = []; // Store all listings for filtering
  let isLoading = true;
  let error: string | null = null;
  let statusError: string | null = null;
  let listingToDelete: Listing | null = null;
  let listingToUpdateStatus: { listing: Listing; newStatus: 'ACTIVE' | 'DRAFT' } | null = null;

  // Filters and sorting
  let statusFilter: 'ALL' | 'ACTIVE' | 'DRAFT' = 'ALL';
  let categoryFilter: string = 'ALL';
  let locationFilter: string = 'ALL';
  let hasImagesFilter: boolean = false;
  let sortBy: string = 'createdAt';
  let order: 'asc' | 'desc' = 'desc';
  let viewMode: 'grid' | 'list' = 'grid';

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
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/${idToDelete}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          ...authHeaders
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete listing');
      }

      // Remove the deleted listing from the list
      allListings = allListings.filter(listing => listing.id !== idToDelete);
      applyFiltersAndSort();
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

    // Clear any previous status errors
    statusError = null;

    // Check active ads limit before activating
    if (newStatus === 'ACTIVE' && $authState.user?.sub) {
      const limitCheck = await checkActiveAdsLimit($authState.user.sub, listing.id);
      if (limitCheck.hasReachedLimit) {
        statusError = `You are allowed to have only ${config.user.maxActiveAds} active ad${config.user.maxActiveAds > 1 ? 's' : ''}. To add more ads, please contact us.`;
        listingToUpdateStatus = null;
        const modal = document.getElementById('status-modal') as HTMLDialogElement;
        modal?.close();
        return;
      }
    }

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/${listing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Update the listing status in the allListings array
      allListings = allListings.map(l => 
        l.id === listing.id 
          ? { ...l, status: newStatus }
          : l
      );
      applyFiltersAndSort();

      // Close the modal and reset
      listingToUpdateStatus = null;
      const modal = document.getElementById('status-modal') as HTMLDialogElement;
      modal?.close();
      statusError = null; // Clear any previous errors
    } catch (e) {
      statusError = e instanceof Error ? e.message : 'Failed to update status';
      console.error('Error updating status:', e);
      listingToUpdateStatus = null;
      const modal = document.getElementById('status-modal') as HTMLDialogElement;
      modal?.close();
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
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/user/${$authState.user.sub}`, {
        headers: {
          'Accept': 'application/json',
          ...authHeaders
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }
      const data = await response.json();
      allListings = data.listings;
      console.log('Fetched listings:', allListings);
      applyFiltersAndSort();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load listings';
      console.error('Error:', error);
    } finally {
      isLoading = false;
    }
  }

  function getListingImage(listing: Listing): string | null {
    console.log('Getting image for listing:', listing.id, listing.images);
    if (listing.images && listing.images.length > 0) {
      return listing.images[0].thumbnailPath;
    }
    return null;
  }

  // Get unique categories and locations from listings
  $: uniqueCategories = [...new Set(allListings.map(l => l.categoryId))].map(id => 
    categories.find(c => c.key === id)
  ).filter(Boolean);

  $: uniqueLocations = [...new Set(allListings.map(l => l.locationId))].map(id => 
    locations.find(l => l.key === id)
  ).filter(Boolean);

  function applyFiltersAndSort() {
    let filtered = [...allListings];

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(l => 
        (statusFilter === 'ACTIVE' && (l.status === 'ACTIVE' || l.status === 'active')) ||
        (statusFilter === 'DRAFT' && (l.status === 'DRAFT' || l.status === 'draft'))
      );
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      const categoryId = parseInt(categoryFilter);
      filtered = filtered.filter(l => l.categoryId === categoryId);
    }

    // Location filter
    if (locationFilter !== 'ALL') {
      const locationId = parseInt(locationFilter);
      filtered = filtered.filter(l => l.locationId === locationId);
    }

    // Has images filter
    if (hasImagesFilter) {
      filtered = filtered.filter(l => l.images && l.images.length > 0);
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'price') {
        const priceA = Number(a.price) || 0;
        const priceB = Number(b.price) || 0;
        comparison = priceA - priceB;
      } else if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return order === 'asc' ? comparison : -comparison;
    });

    listings = filtered;
  }

  function handleSort(newSortBy: string) {
    if (sortBy === newSortBy) {
      order = order === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = newSortBy;
      order = 'desc';
    }
    applyFiltersAndSort();
  }

</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">My Ads</h1>
    <a href="/post-ad" class="btn btn-primary btn-sm normal-case gap-2">
      <Icon icon="material-symbols:add" class="w-5 h-5" />
      Post New Ad
    </a>
  </div>

  <!-- Filters and Controls -->
  {#if !isLoading && allListings.length > 0}
    <div class="mb-6 space-y-4">
      <!-- Filter Row 1: Status, Category, Location -->
      <div class="flex flex-wrap items-center gap-4">
        <!-- Status Filter -->
        <div class="form-control">
          <label class="label">
            <span class="label-text text-sm">Status</span>
          </label>
          <select 
            class="select select-bordered select-sm w-32"
            bind:value={statusFilter}
            on:change={applyFiltersAndSort}
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>

        <!-- Category Filter -->
        <div class="form-control">
          <label class="label">
            <span class="label-text text-sm">Category</span>
          </label>
          <select 
            class="select select-bordered select-sm w-48"
            bind:value={categoryFilter}
            on:change={applyFiltersAndSort}
          >
            <option value="ALL">All Categories</option>
            {#each uniqueCategories as cat}
              {#if cat}
                <option value={cat.key.toString()}>{cat.value}</option>
              {/if}
            {/each}
          </select>
        </div>

        <!-- Location Filter -->
        <div class="form-control">
          <label class="label">
            <span class="label-text text-sm">Location</span>
          </label>
          <select 
            class="select select-bordered select-sm w-48"
            bind:value={locationFilter}
            on:change={applyFiltersAndSort}
          >
            <option value="ALL">All Locations</option>
            {#each uniqueLocations as loc}
              {#if loc}
                <option value={loc.key.toString()}>{loc.value}</option>
              {/if}
            {/each}
          </select>
        </div>

        <!-- Has Images Filter -->
        <div class="form-control flex-1">
          <label class="label cursor-pointer justify-start gap-2 pt-8">
            <input 
              type="checkbox" 
              class="checkbox checkbox-primary checkbox-sm"
              bind:checked={hasImagesFilter}
              on:change={applyFiltersAndSort}
            />
            <span class="label-text text-sm">With images only</span>
          </label>
        </div>
      </div>

      <!-- Filter Row 2: Sort and View Toggle -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <SortButtons {sortBy} {order} disabled={listings.length === 0} onSort={handleSort} />
        
        <div class="flex items-center gap-2">
          <span class="text-sm text-base-content/70">{listings.length} listing{listings.length !== 1 ? 's' : ''}</span>
          <div class="btn-group">
            <button
              class="btn btn-sm {viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}"
              on:click={() => viewMode = 'grid'}
              title="Grid View"
            >
              <Icon icon="material-symbols:grid-view" class="w-4 h-4" />
            </button>
            <button
              class="btn btn-sm {viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}"
              on:click={() => viewMode = 'list'}
              title="List View"
            >
              <Icon icon="material-symbols:view-list" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if statusError}
    <div class="alert alert-error mb-4">
      <Icon icon="material-symbols:error" class="w-6 h-6" />
      <span>{statusError}</span>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" class="w-6 h-6" />
      <span>{error}</span>
    </div>
  {:else if allListings.length === 0}
    <div class="text-center py-12">
      <div class="text-6xl mb-4">📭</div>
      <h3 class="text-xl font-medium mb-2">No Ads Yet</h3>
      <p class="text-base-content/60 mb-6">Start selling by posting your first ad!</p>
      <a href="/post-ad" class="btn btn-primary normal-case gap-2">
        <Icon icon="material-symbols:add" class="w-5 h-5" />
        Post Your First Ad
      </a>
    </div>
  {:else if listings.length === 0}
    <div class="text-center py-12">
      <div class="text-4xl mb-4">🔍</div>
      <h3 class="text-xl font-medium mb-2">No listings match your filters</h3>
      <p class="text-base-content/60 mb-6">Try adjusting your filters to see more results.</p>
      <button 
        class="btn btn-ghost normal-case gap-2"
        on:click={() => {
          statusFilter = 'ALL';
          categoryFilter = 'ALL';
          locationFilter = 'ALL';
          hasImagesFilter = false;
          applyFiltersAndSort();
        }}
      >
        Clear Filters
      </button>
    </div>
  {:else if viewMode === 'grid'}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each listings as listing (listing.id)}
        <div class="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <figure class="relative pt-[50%] bg-base-200">
            {#if getListingImage(listing)}
              <img
                src={getListingImage(listing)}
                alt={listing.title}
                class="absolute inset-0 w-full h-full object-cover"
                on:error={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = 'none';
                  const placeholder = img.nextElementSibling as HTMLElement;
                  if (placeholder) {
                    placeholder.style.display = 'flex';
                  }
                }}
              />
            {/if}
            <div class="absolute inset-0 flex items-center justify-center {getListingImage(listing) ? 'hidden' : 'flex'}">
              <Icon icon="material-symbols:image" class="text-4xl text-gray-400" />
            </div>
            <div class="absolute top-2 right-2">
              {#key listing.status}
                <span 
                  in:scale={{duration: 300, easing: elasticOut}}
                  out:fade={{duration: 200}}
                  class="badge {(listing.status === 'ACTIVE' || listing.status === 'active') ? 'badge-success' : 'badge-warning'} badge-sm animate-pulse"
                >
                  {listing.status === 'ACTIVE' || listing.status === 'active' ? 'ACTIVE' : (listing.status === 'DRAFT' || listing.status === 'draft' ? 'DRAFT' : listing.status?.toUpperCase() || 'DRAFT')}
                </span>
              {/key}
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
                  class="btn btn-sm btn-{(listing.status === 'ACTIVE' || listing.status === 'active') ? 'warning' : 'success'} btn-outline gap-1 w-full"
                  on:click={() => showStatusConfirmation(listing, (listing.status === 'ACTIVE' || listing.status === 'active') ? 'DRAFT' : 'ACTIVE')}
                >
                  <Icon icon="material-symbols:{(listing.status === 'ACTIVE' || listing.status === 'active') ? 'pause' : 'play-arrow'}" class="w-4 h-4" />
                  {(listing.status === 'ACTIVE' || listing.status === 'active') ? 'Pause' : 'Activate'}
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
  {:else}
    <!-- List View -->
    <div class="space-y-4">
      {#each listings as listing (listing.id)}
        <div class="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div class="card-body flex flex-row gap-4 p-4">
            <figure class="relative w-32 h-32 flex-shrink-0 bg-base-200 rounded-lg overflow-hidden">
              {#if getListingImage(listing)}
                <img
                  src={getListingImage(listing)}
                  alt={listing.title}
                  class="absolute inset-0 w-full h-full object-cover"
                  on:error={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.style.display = 'none';
                    const placeholder = img.nextElementSibling as HTMLElement;
                    if (placeholder) {
                      placeholder.style.display = 'flex';
                    }
                  }}
                />
              {/if}
              <div class="absolute inset-0 flex items-center justify-center {getListingImage(listing) ? 'hidden' : 'flex'}">
                <Icon icon="material-symbols:image" class="text-2xl text-gray-400" />
              </div>
              <div class="absolute top-1 right-1">
                <span 
                  class="badge {(listing.status === 'ACTIVE' || listing.status === 'active') ? 'badge-success' : 'badge-warning'} badge-xs"
                >
                  {listing.status === 'ACTIVE' || listing.status === 'active' ? 'ACTIVE' : (listing.status === 'DRAFT' || listing.status === 'draft' ? 'DRAFT' : listing.status?.toUpperCase() || 'DRAFT')}
                </span>
              </div>
            </figure>
            <div class="flex-1 flex flex-col justify-between">
              <div>
                <h2 class="card-title text-lg mb-2">{listing.title}</h2>
                <p class="text-xl font-bold text-primary mb-2">{formatCurrency(Number(listing.price))}</p>
                <div class="flex flex-wrap gap-4 text-sm text-base-content/70 mb-2">
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
              </div>
              <div class="flex gap-2 mt-4">
                <a 
                  href="/list/{listing.slug}" 
                  class="btn btn-sm btn-primary gap-1"
                >
                  <Icon icon="material-symbols:visibility" class="w-4 h-4" />
                  View
                </a>
                <a 
                  href="/my-ads/edit/{listing.id}" 
                  class="btn btn-sm btn-info gap-1"
                >
                  <Icon icon="material-symbols:edit" class="w-4 h-4" />
                  Edit
                </a>
                <button 
                  class="btn btn-sm btn-{(listing.status === 'ACTIVE' || listing.status === 'active') ? 'warning' : 'success'} btn-outline gap-1"
                  on:click={() => showStatusConfirmation(listing, (listing.status === 'ACTIVE' || listing.status === 'active') ? 'DRAFT' : 'ACTIVE')}
                >
                  <Icon icon="material-symbols:{(listing.status === 'ACTIVE' || listing.status === 'active') ? 'pause' : 'play-arrow'}" class="w-4 h-4" />
                  {(listing.status === 'ACTIVE' || listing.status === 'active') ? 'Pause' : 'Activate'}
                </button>
                <button 
                  class="btn btn-sm btn-error btn-outline gap-1"
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
