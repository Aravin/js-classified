<script lang="ts">
  // onMount is not used here — data loading is driven by the reactive $authState block
  import { config } from '$lib/config';
  import { authState, getAuthHeaders, login } from '$lib/auth/auth0';
  import Icon from '@iconify/svelte';
  import { formatCurrency, formatDate, checkActiveAdsLimit, isListingExpired } from '$lib/utils';
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
    republishedAt?: string;
    republishCount?: number;
  }

  let listings: Listing[] = [];
  let allListings: Listing[] = []; // Store all listings for filtering
  let isLoading = true;
  let hasLoaded = false; // Guard against duplicate loadListings() calls
  let error: string | null = null;
  let statusError: string | null = null;
  let listingToDelete: Listing | null = null;
  let listingToUpdateStatus: { listing: Listing; newStatus: 'ACTIVE' | 'DRAFT' } | null = null;
  let listingToRepublish: Listing | null = null;
  let isRepublishing = false;

  // Filters and sorting
  let statusFilter: 'ALL' | 'ACTIVE' | 'DRAFT' | 'EXPIRED' = 'ALL';
  let categoryFilter: string = 'ALL';
  let locationFilter: string = 'ALL';
  let hasImagesFilter: boolean = false;
  let sortBy: string = 'createdAt';
  let order: 'asc' | 'desc' = 'desc';
  let viewMode: 'grid' | 'list' = 'grid';

  // Helper: normalise status comparison
  function isListingActive(status: string): boolean {
    return status === 'ACTIVE' || status === 'active';
  }

  // Trigger Auth0 login popup; store redirect destination so user returns to /my-ads after login
  async function redirectToLogin() {
    if (browser) {
      sessionStorage.setItem('redirectAfterLogin', '/my-ads');
      await login();
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
          Accept: 'application/json',
          ...authHeaders,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete listing');
      }

      // Remove the deleted listing from the list
      allListings = allListings.filter((listing) => listing.id !== idToDelete);
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
        statusError = `You are allowed to have only ${limitCheck.activeLimit} active ad${limitCheck.activeLimit > 1 ? 's' : ''}. To add more ads, please contact us.`;
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
          Accept: 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Update the listing status in the allListings array
      allListings = allListings.map((l) => (l.id === listing.id ? { ...l, status: newStatus } : l));
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

  async function handleRepublish() {
    if (!listingToRepublish) return;
    const listing = listingToRepublish;

    // Clear any previous status errors
    statusError = null;
    isRepublishing = true;

    // Check active ads limit before activating
    if ($authState.user?.sub) {
      const limitCheck = await checkActiveAdsLimit($authState.user.sub, listing.id);
      if (limitCheck.hasReachedLimit) {
        statusError = `You are allowed to have only ${limitCheck.activeLimit} active ad${limitCheck.activeLimit > 1 ? 's' : ''}. To add more ads, please contact us.`;
        listingToRepublish = null;
        const modal = document.getElementById('republish-modal') as HTMLDialogElement;
        modal?.close();
        isRepublishing = false;
        return;
      }
    }

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/${listing.id}/republish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...authHeaders,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to republish listing');
      }

      const updatedListing = await response.json();

      // Update the listing status, createdAt, republishedAt, and republishCount in the allListings array
      allListings = allListings.map((l) =>
        l.id === listing.id
          ? {
              ...l,
              status: 'ACTIVE',
              createdAt: updatedListing.createdAt,
              republishedAt: updatedListing.republishedAt,
              republishCount: updatedListing.republishCount,
            }
          : l,
      );
      applyFiltersAndSort();

      // Close the modal and reset
      listingToRepublish = null;
      const modal = document.getElementById('republish-modal') as HTMLDialogElement;
      modal?.close();
      statusError = null; // Clear any previous errors
    } catch (e) {
      statusError = e instanceof Error ? e.message : 'Failed to republish listing';
      console.error('Error republishing listing:', e);
      listingToRepublish = null;
      const modal = document.getElementById('republish-modal') as HTMLDialogElement;
      modal?.close();
    } finally {
      isRepublishing = false;
    }
  }

  function showRepublishConfirmation(listing: Listing) {
    listingToRepublish = listing;
    const modal = document.getElementById('republish-modal') as HTMLDialogElement;
    modal?.showModal();
  }

  $: if (!$authState.isInitializing && !$authState.isAuthenticated) {
    redirectToLogin();
  }

  $: if (
    !$authState.isInitializing &&
    $authState.isAuthenticated &&
    $authState.user &&
    !hasLoaded
  ) {
    loadListings();
  }

  async function loadListings() {
    if (!$authState.user?.sub) return;

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/user/${$authState.user.sub}`, {
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch listings');
      }
      const data = await response.json();
      allListings = data.listings;
      hasLoaded = true;
      applyFiltersAndSort();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load listings';
      console.error('Error:', error);
    } finally {
      isLoading = false;
    }
  }

  function getListingImage(listing: Listing): string | null {
    if (listing.images && listing.images.length > 0) {
      return listing.images[0].thumbnailPath;
    }
    return null;
  }

  // Get unique categories and locations from listings
  $: uniqueCategories = [...new Set(allListings.map((l) => l.categoryId))]
    .map((id) => categories.find((c) => c.key === id))
    .filter(Boolean);

  $: uniqueLocations = [...new Set(allListings.map((l) => l.locationId))]
    .map((id) => locations.find((l) => l.key === id))
    .filter(Boolean);

  function applyFiltersAndSort() {
    let filtered = [...allListings];

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((l) => {
        if (statusFilter === 'EXPIRED') return isListingExpired(l.createdAt);
        if (statusFilter === 'ACTIVE')
          return isListingActive(l.status) && !isListingExpired(l.createdAt);
        if (statusFilter === 'DRAFT') return l.status === 'DRAFT' || l.status === 'draft';
        return true;
      });
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      const categoryId = parseInt(categoryFilter);
      filtered = filtered.filter((l) => l.categoryId === categoryId);
    }

    // Location filter
    if (locationFilter !== 'ALL') {
      const locationId = parseInt(locationFilter);
      filtered = filtered.filter((l) => l.locationId === locationId);
    }

    // Has images filter
    if (hasImagesFilter) {
      filtered = filtered.filter((l) => l.images && l.images.length > 0);
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

<svelte:head>
  <title>My Ads | locful</title>
  <meta
    name="description"
    content="Manage your classified ads — view, edit, activate or delete your listings."
  />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-bold">My Ads</h1>
    <a href="/post-ad" class="btn btn-primary btn-sm gap-2 normal-case">
      <Icon icon="material-symbols:add" class="h-5 w-5" />
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
            <option value="EXPIRED">Expired</option>
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
              class="checkbox-primary checkbox checkbox-sm"
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
          <span class="text-sm text-base-content/70"
            >{listings.length} listing{listings.length !== 1 ? 's' : ''}</span
          >
          <div class="btn-group">
            <button
              class="btn btn-sm {viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}"
              on:click={() => (viewMode = 'grid')}
              title="Grid View"
            >
              <Icon icon="material-symbols:grid-view" class="h-4 w-4" />
            </button>
            <button
              class="btn btn-sm {viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}"
              on:click={() => (viewMode = 'list')}
              title="List View"
            >
              <Icon icon="material-symbols:view-list" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if statusError}
    <div class="alert alert-error mb-4">
      <Icon icon="material-symbols:error" class="h-6 w-6" />
      <span>{statusError}</span>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" class="h-6 w-6" />
      <span>{error}</span>
    </div>
  {:else if allListings.length === 0}
    <div class="py-12 text-center">
      <div class="mb-4 text-6xl">📭</div>
      <h3 class="mb-2 text-xl font-medium">No Ads Yet</h3>
      <p class="mb-6 text-base-content/60">Start selling by posting your first ad!</p>
      <a href="/post-ad" class="btn btn-primary gap-2 normal-case">
        <Icon icon="material-symbols:add" class="h-5 w-5" />
        Post Your First Ad
      </a>
    </div>
  {:else if listings.length === 0}
    <div class="py-12 text-center">
      <div class="mb-4 text-4xl">🔍</div>
      <h3 class="mb-2 text-xl font-medium">No listings match your filters</h3>
      <p class="mb-6 text-base-content/60">Try adjusting your filters to see more results.</p>
      <button
        class="btn btn-ghost gap-2 normal-case"
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
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each listings as listing (listing.id)}
        {@const imgSrc = getListingImage(listing)}
        {@const expired = isListingExpired(listing.createdAt)}
        {@const active = isListingActive(listing.status)}
        <div class="card bg-base-100 shadow-lg transition-shadow hover:shadow-xl">
          <figure class="relative bg-base-200 pt-[50%]">
            {#if imgSrc}
              <img
                src={imgSrc}
                alt={listing.title}
                class="absolute inset-0 h-full w-full object-cover"
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
            <div
              class="absolute inset-0 flex items-center justify-center {imgSrc ? 'hidden' : 'flex'}"
            >
              <Icon icon="material-symbols:image" class="text-4xl text-gray-400" />
            </div>
            <div class="absolute right-2 top-2">
              {#key listing.status}
                <span
                  in:scale={{ duration: 300, easing: elasticOut }}
                  out:fade={{ duration: 200 }}
                  class="badge {expired
                    ? 'badge-error'
                    : active
                      ? 'badge-success'
                      : 'badge-warning'} badge-sm animate-pulse"
                >
                  {expired
                    ? 'EXPIRED'
                    : active
                      ? 'ACTIVE'
                      : listing.status === 'DRAFT' || listing.status === 'draft'
                        ? 'DRAFT'
                        : listing.status?.toUpperCase() || 'DRAFT'}
                </span>
              {/key}
            </div>
          </figure>
          <div class="card-body">
            <h2 class="card-title text-lg">{listing.title}</h2>
            <p class="text-2xl font-bold text-primary">{formatCurrency(Number(listing.price))}</p>
            <div class="flex flex-col gap-1 text-sm text-base-content/70">
              <div class="flex items-center gap-1">
                <Icon icon="material-symbols:location-on" class="h-4 w-4" />
                <span>{listing.location.name}</span>
              </div>
              <div class="flex items-center gap-1">
                <Icon icon="material-symbols:category" class="h-4 w-4" />
                <span>{listing.category.name}</span>
              </div>
              <div class="flex items-center gap-1">
                <Icon icon="material-symbols:calendar-month" class="h-4 w-4" />
                <span>{formatDate(listing.createdAt)}</span>
              </div>
              {#if listing.republishCount && listing.republishCount > 0}
                <div class="flex items-center gap-1 text-xs font-medium text-success">
                  <Icon icon="material-symbols:refresh" class="h-3.5 w-3.5" />
                  <span>
                    Republished {listing.republishCount} time{listing.republishCount !== 1
                      ? 's'
                      : ''}
                    {#if listing.republishedAt}
                      (last: {formatDate(listing.republishedAt)})
                    {/if}
                  </span>
                </div>
              {/if}
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <div class="col-span-1">
                <a href="/list/{listing.slug}" class="btn btn-primary btn-sm w-full gap-1">
                  <Icon icon="material-symbols:visibility" class="h-4 w-4" />
                  View
                </a>
              </div>
              <div class="col-span-1">
                <a href="/my-ads/edit/{listing.id}" class="btn btn-info btn-sm w-full gap-1">
                  <Icon icon="material-symbols:edit" class="h-4 w-4" />
                  Edit
                </a>
              </div>
              <div class="col-span-1">
                {#if expired}
                  <button
                    class="btn btn-outline btn-success btn-sm w-full gap-1"
                    on:click={() => showRepublishConfirmation(listing)}
                  >
                    <Icon icon="material-symbols:refresh" class="h-4 w-4" />
                    Republish
                  </button>
                {:else}
                  <button
                    class="btn btn-sm btn-{active ? 'warning' : 'success'} btn-outline w-full gap-1"
                    on:click={() => showStatusConfirmation(listing, active ? 'DRAFT' : 'ACTIVE')}
                  >
                    <Icon
                      icon="material-symbols:{active ? 'pause' : 'play-arrow'}"
                      class="h-4 w-4"
                    />
                    {active ? 'Pause' : 'Activate'}
                  </button>
                {/if}
              </div>
              <div class="col-span-1">
                <button
                  class="btn btn-outline btn-error btn-sm w-full gap-1"
                  on:click={() => showDeleteConfirmation(listing)}
                >
                  <Icon icon="material-symbols:delete" class="h-4 w-4" />
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
        {@const imgSrc = getListingImage(listing)}
        {@const expired = isListingExpired(listing.createdAt)}
        {@const active = isListingActive(listing.status)}
        <div class="card bg-base-100 shadow-lg transition-shadow hover:shadow-xl">
          <div class="card-body flex flex-row gap-4 p-4">
            <figure class="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-base-200">
              {#if imgSrc}
                <img
                  src={imgSrc}
                  alt={listing.title}
                  class="absolute inset-0 h-full w-full object-cover"
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
              <div
                class="absolute inset-0 flex items-center justify-center {imgSrc
                  ? 'hidden'
                  : 'flex'}"
              >
                <Icon icon="material-symbols:image" class="text-2xl text-gray-400" />
              </div>
              <div class="absolute right-1 top-1">
                <span
                  class="badge {expired
                    ? 'badge-error'
                    : active
                      ? 'badge-success'
                      : 'badge-warning'} badge-xs"
                >
                  {expired
                    ? 'EXPIRED'
                    : active
                      ? 'ACTIVE'
                      : listing.status === 'DRAFT' || listing.status === 'draft'
                        ? 'DRAFT'
                        : listing.status?.toUpperCase() || 'DRAFT'}
                </span>
              </div>
            </figure>
            <div class="flex flex-1 flex-col justify-between">
              <div>
                <h2 class="card-title mb-2 text-lg">{listing.title}</h2>
                <p class="mb-2 text-xl font-bold text-primary">
                  {formatCurrency(Number(listing.price))}
                </p>
                <div class="mb-2 flex flex-wrap gap-4 text-sm text-base-content/70">
                  <div class="flex items-center gap-1">
                    <Icon icon="material-symbols:location-on" class="h-4 w-4" />
                    <span>{listing.location.name}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Icon icon="material-symbols:category" class="h-4 w-4" />
                    <span>{listing.category.name}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Icon icon="material-symbols:calendar-month" class="h-4 w-4" />
                    <span>{formatDate(listing.createdAt)}</span>
                  </div>
                  {#if listing.republishCount && listing.republishCount > 0}
                    <div class="flex items-center gap-1 text-xs font-medium text-success">
                      <Icon icon="material-symbols:refresh" class="h-3.5 w-3.5" />
                      <span>
                        Republished {listing.republishCount} time{listing.republishCount !== 1
                          ? 's'
                          : ''}
                        {#if listing.republishedAt}
                          (last: {formatDate(listing.republishedAt)})
                        {/if}
                      </span>
                    </div>
                  {/if}
                </div>
              </div>
              <div class="mt-4 flex gap-2">
                <a href="/list/{listing.slug}" class="btn btn-primary btn-sm gap-1">
                  <Icon icon="material-symbols:visibility" class="h-4 w-4" />
                  View
                </a>
                <a href="/my-ads/edit/{listing.id}" class="btn btn-info btn-sm gap-1">
                  <Icon icon="material-symbols:edit" class="h-4 w-4" />
                  Edit
                </a>
                {#if expired}
                  <button
                    class="btn btn-outline btn-success btn-sm gap-1"
                    on:click={() => showRepublishConfirmation(listing)}
                  >
                    <Icon icon="material-symbols:refresh" class="h-4 w-4" />
                    Republish
                  </button>
                {:else}
                  <button
                    class="btn btn-sm btn-{active ? 'warning' : 'success'} btn-outline gap-1"
                    on:click={() => showStatusConfirmation(listing, active ? 'DRAFT' : 'ACTIVE')}
                  >
                    <Icon
                      icon="material-symbols:{active ? 'pause' : 'play-arrow'}"
                      class="h-4 w-4"
                    />
                    {active ? 'Pause' : 'Activate'}
                  </button>
                {/if}
                <button
                  class="btn btn-outline btn-error btn-sm gap-1"
                  on:click={() => showDeleteConfirmation(listing)}
                >
                  <Icon icon="material-symbols:delete" class="h-4 w-4" />
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
    <h3 class="text-lg font-bold">Confirm Deletion</h3>
    <p class="py-4">
      Are you sure you want to delete "{listingToDelete?.title}"? This action cannot be undone.
    </p>
    <div class="modal-action">
      <form method="dialog">
        <div class="flex gap-2">
          <button class="btn">Cancel</button>
          <button class="btn btn-error" on:click|preventDefault={handleDelete}> Delete </button>
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
    <h3 class="text-lg font-bold">Confirm Status Change</h3>
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

<!-- Republish Confirmation Modal -->
<dialog id="republish-modal" class="modal modal-bottom sm:modal-middle">
  <div class="modal-box">
    <h3 class="text-lg font-bold">Confirm Republishing</h3>
    <p class="py-4">
      {#if listingToRepublish}
        Are you sure you want to republish "{listingToRepublish.title}"? This will reset its
        creation date to today and make it active for another {config.listing.expiryDays} days.
      {/if}
    </p>
    <div class="modal-action">
      <form method="dialog">
        <div class="flex gap-2">
          <button class="btn" disabled={isRepublishing}>Cancel</button>
          <button
            class="btn btn-success"
            on:click|preventDefault={handleRepublish}
            disabled={isRepublishing}
          >
            {#if isRepublishing}
              <Icon icon="material-symbols:hourglass-bottom" class="mr-2 h-4 w-4 animate-spin" />
              Republishing...
            {:else}
              Republish
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
