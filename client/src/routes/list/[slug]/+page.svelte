<script lang="ts">
  import { formatCurrency, formatDate, checkActiveAdsLimit } from '$lib/utils';
  import Icon from '@iconify/svelte';
  import { config } from '$lib/config';
  import RelevantListings from '$lib/components/RelevantListings.svelte';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { getAuthHeaders, authState, login, user } from '$lib/auth/auth0';
  import { generateListingStructuredData } from '$lib/google-integration';
  import { goto, invalidateAll } from '$app/navigation';
  import {
    createListingInteractionState,
    shouldResetListingInteractionState,
  } from '$lib/listing-interaction-state';
  import { refreshRewardSummary } from '$lib/rewards';

  /** Safely serialize JSON-LD: escapes closing script tags to prevent XSS */
  function safeJsonLd(data: object): string {
    return JSON.stringify(data).replace(new RegExp('</s' + 'cript>', 'gi'), '<\\/script>');
  }

  function getErrorMessage(errorPayload: unknown, fallback: string): string {
    if (typeof errorPayload === 'string' && errorPayload.trim()) {
      return errorPayload;
    }

    if (Array.isArray(errorPayload)) {
      const messages = errorPayload
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }

          if (item && typeof item === 'object' && 'message' in item) {
            const message = (item as { message?: unknown }).message;
            return typeof message === 'string' ? message : null;
          }

          return null;
        })
        .filter((message): message is string => Boolean(message && message.trim()));

      if (messages.length > 0) {
        return messages.join(', ');
      }
    }

    if (errorPayload && typeof errorPayload === 'object') {
      if ('message' in errorPayload) {
        const message = (errorPayload as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }

      if ('error' in errorPayload) {
        return getErrorMessage((errorPayload as { error?: unknown }).error, fallback);
      }
    }

    return fallback;
  }

  export let data;
  $: listing = data.listing;

  // Generate structured data for SEO
  $: structuredData = generateListingStructuredData(listing);

  // Check if current user owns this listing
  let isOwner = false;
  let checkingOwnership = false;

  // Delete and status update state
  let listingToDelete: typeof listing | null = null;
  let listingToUpdateStatus: { listing: typeof listing; newStatus: 'ACTIVE' | 'DRAFT' } | null =
    null;
  let listingToRepublish: typeof listing | null = null;
  let deleteError: string | null = null;
  let statusError: string | null = null;
  let isDeleting = false;
  let isUpdatingStatus = false;
  let isRepublishing = false;

  let {
    contactInfo,
    isLoading,
    error,
    cachedContactInfo,
    selectedImage,
    showLoginPrompt,
    feedbackRating,
    feedbackComment,
    feedbackError,
    feedbackSuccess,
    isSubmittingFeedback,
    hasRevealedContact,
    trackedView,
  } = createListingInteractionState();
  let previousListingId: number | null = null;
  let viewTrackingInFlight = false;

  const LISTING_EXPIRY_DAYS = config.listing.expiryDays;

  // Check if listing belongs to current user
  async function checkOwnership() {
    if (!$authState.isAuthenticated || !$user?.sub) {
      isOwner = false;
      return;
    }

    if (!listing?.id && !listing?.slug) {
      isOwner = false;
      return;
    }

    checkingOwnership = true;

    try {
      const authHeaders = await getAuthHeaders();

      // Check if listing ID is in user's listings
      const userListingsResponse = await fetch(`${config.api.baseUrl}/listings/user/${$user.sub}`, {
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
      });

      if (userListingsResponse.ok) {
        const userListings = await userListingsResponse.json();
        isOwner =
          userListings.listings?.some((l: { id?: number; slug?: string }) => {
            return (listing.id && l.id === listing.id) || (listing.slug && l.slug === listing.slug);
          }) || false;
      } else {
        // API call failed - assume user doesn't own the listing
        isOwner = false;
      }
    } catch {
      isOwner = false;
    } finally {
      checkingOwnership = false;
    }
  }

  // Reactive statement to check ownership when auth state changes
  let prevUserId: string | null = null;

  function resetListingInteractionState() {
    ({
      contactInfo,
      isLoading,
      error,
      cachedContactInfo,
      selectedImage,
      showLoginPrompt,
      feedbackRating,
      feedbackComment,
      feedbackError,
      feedbackSuccess,
      isSubmittingFeedback,
      hasRevealedContact,
      trackedView,
    } = createListingInteractionState());
  }

  $: {
    const nextListingId = listing?.id ?? null;
    if (browser && shouldResetListingInteractionState(previousListingId, nextListingId)) {
      previousListingId = nextListingId;
      resetListingInteractionState();
      void trackListingView();
    }
  }

  $: {
    if (browser && $authState.isAuthenticated && $user?.sub && (listing?.id || listing?.slug)) {
      const ownershipKey = `${$user.sub}:${listing?.id ?? listing?.slug}`;
      if (ownershipKey !== prevUserId) {
        prevUserId = ownershipKey;
        checkOwnership();
      }
    } else if (!$authState.isAuthenticated) {
      isOwner = false;
      prevUserId = null;
    }
  }

  onMount(() => {
    if (browser) {
      // Wait for reCAPTCHA to be ready
      if (window.grecaptcha?.enterprise) {
        window.grecaptcha.enterprise.ready(() => {
          // reCAPTCHA is now ready
        });
      }

      // Check ownership if user is already authenticated
      if ($authState.isAuthenticated && $user?.sub && (listing?.id || listing?.slug)) {
        prevUserId = `${$user.sub}:${listing?.id ?? listing?.slug}`;
        checkOwnership();
      }
    }
  });

  async function trackListingView() {
    if (!listing?.id || trackedView || viewTrackingInFlight) {
      return;
    }

    viewTrackingInFlight = true;
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/${listing.id}/view`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
      });
      if (response.ok) {
        trackedView = true;
      }
    } catch {
      // Ignore view tracking failures for the page UX.
    } finally {
      viewTrackingInFlight = false;
    }
  }

  function handleEdit() {
    if (!listing?.id) {
      return;
    }
    goto(`/my-ads/edit/${listing.id}`);
  }

  function showDeleteConfirmation() {
    listingToDelete = listing;
    const modal = document.getElementById('delete-modal') as HTMLDialogElement;
    modal?.showModal();
  }

  async function handleDelete() {
    if (!listingToDelete?.id) return;
    isDeleting = true;
    deleteError = null;

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/${listingToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete listing');
      }

      // Close modal and redirect to my-ads page
      listingToDelete = null;
      const modal = document.getElementById('delete-modal') as HTMLDialogElement;
      modal?.close();

      await goto('/my-ads');
    } catch (err) {
      deleteError = err instanceof Error ? err.message : 'Failed to delete listing';
    } finally {
      isDeleting = false;
    }
  }

  function showStatusConfirmation(newStatus: 'ACTIVE' | 'DRAFT') {
    listingToUpdateStatus = { listing, newStatus };
    const modal = document.getElementById('status-modal') as HTMLDialogElement;
    modal?.showModal();
  }

  async function handleStatusUpdate() {
    if (!listingToUpdateStatus || !listing?.id) return;
    const { newStatus } = listingToUpdateStatus;

    statusError = null;
    isUpdatingStatus = true;

    // Check active ads limit before activating
    if (newStatus === 'ACTIVE' && $user?.sub) {
      const limitCheck = await checkActiveAdsLimit($user.sub, listing.id);
      if (limitCheck.hasReachedLimit) {
        statusError = `You are allowed to have only ${limitCheck.activeLimit} active ad${limitCheck.activeLimit > 1 ? 's' : ''}. To add more ads, please contact us.`;
        listingToUpdateStatus = null;
        const modal = document.getElementById('status-modal') as HTMLDialogElement;
        modal?.close();
        isUpdatingStatus = false;
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

      // Close modal and refresh the page using SvelteKit (preserves history)
      listingToUpdateStatus = null;
      const modal = document.getElementById('status-modal') as HTMLDialogElement;
      modal?.close();

      // Re-run load functions without a full page reload
      await invalidateAll();
    } catch (err) {
      statusError = err instanceof Error ? err.message : 'Failed to update status';
    } finally {
      isUpdatingStatus = false;
    }
  }

  function showRepublishConfirmation() {
    listingToRepublish = listing;
    const modal = document.getElementById('republish-modal') as HTMLDialogElement;
    modal?.showModal();
  }

  async function handleRepublish() {
    if (!listing?.id) return;

    statusError = null;
    isRepublishing = true;

    // Check active ads limit before activating
    if ($user?.sub) {
      const limitCheck = await checkActiveAdsLimit($user.sub, listing.id);
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
        throw new Error(getErrorMessage(errData, 'Failed to republish listing'));
      }

      // Close modal and refresh the page using SvelteKit (preserves history)
      listingToRepublish = null;
      const modal = document.getElementById('republish-modal') as HTMLDialogElement;
      modal?.close();

      // Re-run load functions without a full page reload
      await invalidateAll();
    } catch (err) {
      statusError = err instanceof Error ? err.message : 'Failed to republish listing';
    } finally {
      isRepublishing = false;
    }
  }

  // Get current listing status
  $: listingStatus = listing?.status || 'ACTIVE';
  $: isActive = listingStatus === 'ACTIVE' || listingStatus === 'active';
  $: isExpired = listing?.isExpired === true;

  async function getRecaptchaToken(action: string): Promise<string | null> {
    if (!browser) {
      return null;
    }

    // Check if site key is configured
    if (!config.recaptcha.siteKey || config.recaptcha.siteKey.trim() === '') {
      return null;
    }

    if (!window.grecaptcha?.enterprise) {
      return null;
    }

    try {
      return new Promise((resolve) => {
        window.grecaptcha!.enterprise.ready(async () => {
          try {
            const token = await window.grecaptcha!.enterprise.execute(config.recaptcha.siteKey, {
              action,
            });
            resolve(token);
          } catch {
            resolve(null);
          }
        });
      });
    } catch {
      return null;
    }
  }

  async function fetchContactInfo(type: 'phone' | 'email' | 'both') {
    // Check if user is authenticated first
    if (!$authState.isAuthenticated) {
      showLoginPrompt = true;
      return;
    }

    isLoading = true;
    error = null;
    showLoginPrompt = false;

    try {
      // Get reCAPTCHA token before fetching contact info
      const recaptchaToken = await getRecaptchaToken('VIEW_CONTACT');

      // Only fetch if we don't have the data cached
      if (!cachedContactInfo.phone && !cachedContactInfo.email) {
        // Build URL with query parameter to avoid CORS preflight
        let url = `${config.api.baseUrl}/listings/${listing.id}/contact`;
        if (recaptchaToken) {
          url += `?recaptchaToken=${encodeURIComponent(recaptchaToken)}`;
        }

        // Get auth headers for secured contact API
        const authHeaders = await getAuthHeaders();

        if (!authHeaders.Authorization) {
          showLoginPrompt = true;
          return;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...authHeaders,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            showLoginPrompt = true;
            return;
          }
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(getErrorMessage(errorData, 'Failed to fetch contact information'));
        }
        const data = await response.json();
        cachedContactInfo = data.contactInfo;
      }

      hasRevealedContact = Boolean(cachedContactInfo.phone || cachedContactInfo.email);

      // Show only requested contact info
      if (type === 'phone') {
        contactInfo.phone = cachedContactInfo.phone;
      } else if (type === 'email') {
        contactInfo.email = cachedContactInfo.email;
      } else {
        contactInfo = { ...cachedContactInfo };
      }
    } catch {
      error = 'Failed to load contact information. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function submitFeedback() {
    if (!listing?.id || !$authState.isAuthenticated) {
      showLoginPrompt = true;
      return;
    }

    feedbackError = null;
    feedbackSuccess = null;

    if (feedbackRating < 1 || feedbackRating > 5) {
      feedbackError = 'Choose a rating between 1 and 5.';
      return;
    }

    isSubmittingFeedback = true;
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings/${listing.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          rating: feedbackRating,
          comment: feedbackComment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Failed to submit feedback' }));
        throw new Error(getErrorMessage(errData, 'Failed to submit feedback'));
      }

      await refreshRewardSummary(fetch, authHeaders);
      feedbackSuccess = 'Feedback submitted successfully.';
      feedbackComment = '';
      feedbackRating = 0;
    } catch (err) {
      feedbackError = err instanceof Error ? err.message : 'Failed to submit feedback';
    } finally {
      isSubmittingFeedback = false;
    }
  }

  async function handleLogin() {
    showLoginPrompt = false;
    await login();
  }

  function getDaysLeft(createdAt: string, republishedAt?: string | null): number {
    const baseDate = new Date(republishedAt || createdAt);
    const expiryDate = new Date(baseDate.getTime() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  }
</script>

<svelte:head>
  {#if config.recaptcha.siteKey && config.recaptcha.siteKey.trim() !== ''}
    <script
      src="https://www.google.com/recaptcha/enterprise.js?render={config.recaptcha.siteKey}"
      async
      defer
    ></script>
  {/if}

  <!-- Structured Data for Google -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html `<script type="application/ld+json">${safeJsonLd(structuredData)}<` + `/script>`}

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="product" />
  <meta property="og:title" content={listing.title} />
  <meta property="og:description" content={listing.description} />
  <meta property="og:url" content={`https://locful.com/list/${listing.slug}`} />
  <meta property="og:image" content={`https://locful.com/list/${listing.slug}/og.png`} />
  <meta property="product:price:amount" content={listing.price?.toString() || '0'} />
  <meta property="product:price:currency" content="INR" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={listing.title} />
  <meta name="twitter:description" content={listing.description} />
  <meta name="twitter:image" content={`https://locful.com/list/${listing.slug}/og.png`} />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
  <!-- Expired Banner -->
  {#if isExpired}
    {#if isOwner}
      <div class="alert alert-warning mb-4">
        <Icon icon="material-symbols:timer-off-outline" class="h-5 w-5 shrink-0" />
        <div>
          This listing has expired. To make it visible again, activate it from your
          <a href="/my-ads" class="font-bold underline" style="color: inherit;">My Ads</a> page.
        </div>
      </div>
    {:else}
      <div class="alert alert-error mb-4">
        <Icon icon="material-symbols:timer-off-outline" class="h-5 w-5 shrink-0" />
        <span>This listing has expired and is no longer active.</span>
      </div>
    {/if}
  {/if}

  <div class="overflow-hidden rounded-lg bg-white shadow-lg">
    <!-- Image Gallery -->
    {#if listing.images && listing.images.length > 0}
      <div class="space-y-4">
        <!-- Main Image -->
        <div class="relative h-96">
          <img
            src={listing.images[selectedImage || 0].path}
            alt={listing.title}
            class="h-full w-full rounded-lg object-cover"
          />
        </div>

        <!-- Thumbnail Gallery -->
        {#if listing.images.length > 1}
          <div class="flex gap-2 overflow-x-auto py-2">
            {#each listing.images as image, index (image.id ?? index)}
              <button
                class="relative h-24 w-24 flex-shrink-0 cursor-pointer transition-all duration-200
                       {(selectedImage ?? 0) === index
                  ? 'ring-2 ring-primary'
                  : 'hover:ring-2 hover:ring-gray-300'}"
                on:click={() => (selectedImage = index)}
              >
                <img
                  src={image.thumbnailPath || image.path}
                  alt={`${listing.title} - Image ${index + 1}`}
                  class="h-full w-full rounded-md object-cover"
                />
              </button>
            {/each}
          </div>
        {/if}
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
            <div class="hidden text-gray-300 sm:block">•</div>
            <div class="flex items-center gap-1">
              <Icon
                icon="material-symbols:timer-outline"
                class="h-4 w-4 {isExpired ? 'text-error' : ''}"
              />
              {#if isExpired}
                <span class="font-semibold text-error">Expired</span>
              {:else}
                <span>{getDaysLeft(listing.createdAt, listing.republishedAt)} days left</span>
              {/if}
            </div>
            {#if listing.republishCount && listing.republishCount > 0}
              <div class="hidden text-gray-300 sm:block">•</div>
              <div class="flex items-center gap-1 font-medium text-success">
                <Icon icon="material-symbols:refresh" class="h-4 w-4" />
                <span>
                  Republished {listing.republishCount} time{listing.republishCount !== 1 ? 's' : ''}
                  {#if listing.republishedAt}
                    (last: {formatDate(listing.republishedAt)})
                  {/if}
                </span>
              </div>
            {/if}
          </div>

          <!-- Action Buttons for Owner -->
          {#if $authState.isAuthenticated}
            {#if isOwner && listing?.id}
              <div class="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                <button
                  class="btn btn-primary btn-sm"
                  on:click={handleEdit}
                  disabled={checkingOwnership}
                >
                  <Icon icon="material-symbols:edit" class="mr-2 h-4 w-4" />
                  Edit
                </button>
                {#if isExpired}
                  <button
                    class="btn btn-outline btn-success btn-sm"
                    on:click={showRepublishConfirmation}
                    disabled={checkingOwnership || isRepublishing}
                  >
                    {#if isRepublishing}
                      <Icon
                        icon="material-symbols:hourglass-bottom"
                        class="mr-2 h-4 w-4 animate-spin"
                      />
                    {:else}
                      <Icon icon="material-symbols:refresh" class="mr-2 h-4 w-4" />
                    {/if}
                    Republish
                  </button>
                {:else}
                  <button
                    class="btn btn-outline btn-sm {isActive ? 'btn-warning' : 'btn-success'}"
                    on:click={() => showStatusConfirmation(isActive ? 'DRAFT' : 'ACTIVE')}
                    disabled={checkingOwnership || isUpdatingStatus}
                  >
                    {#if isUpdatingStatus}
                      <Icon
                        icon="material-symbols:hourglass-bottom"
                        class="mr-2 h-4 w-4 animate-spin"
                      />
                    {:else if isActive}
                      <Icon icon="material-symbols:pause" class="mr-2 h-4 w-4" />
                    {:else}
                      <Icon icon="material-symbols:play-arrow" class="mr-2 h-4 w-4" />
                    {/if}
                    {isActive ? 'Pause' : 'Activate'}
                  </button>
                {/if}
                <button
                  class="btn btn-outline btn-error btn-sm"
                  on:click={showDeleteConfirmation}
                  disabled={checkingOwnership || isDeleting}
                >
                  {#if isDeleting}
                    <Icon
                      icon="material-symbols:hourglass-bottom"
                      class="mr-2 h-4 w-4 animate-spin"
                    />
                  {:else}
                    <Icon icon="material-symbols:delete" class="mr-2 h-4 w-4" />
                  {/if}
                  Delete
                </button>
              </div>
            {:else if checkingOwnership}
              <div class="mt-4 border-t border-gray-200 pt-4">
                <div class="btn btn-ghost btn-sm cursor-not-allowed opacity-50">
                  <Icon
                    icon="material-symbols:hourglass-bottom"
                    class="mr-2 h-4 w-4 animate-spin"
                  />
                  Checking ownership...
                </div>
              </div>
            {/if}
          {/if}
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
        {#if listing.externalLink}
          <div class="space-y-4">
            <p class="text-sm text-gray-600">
              This is an external listing sourced from our partner platform. Direct contact details
              are not hosted on locful.com.
            </p>
            <a
              href={listing.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-primary flex w-full max-w-sm items-center gap-2"
            >
              <Icon icon="material-symbols:open-in-new" class="h-5 w-5" />
              View Original Listing on OLX
            </a>
          </div>
        {:else if isExpired && !isOwner}
          <div class="text-sm italic text-gray-400">
            Contact information is not available for expired listings.
          </div>
        {:else}
          <div class="space-y-4">
            {#if listing.hasPhone}
              <div class="flex w-[250px] items-center gap-1">
                <Icon icon="ic:baseline-phone" class="h-5 w-5 text-primary" />
                <span class="font-mono">
                  {#if contactInfo.phone}
                    {contactInfo.phone}
                  {:else}
                    *****-*****
                  {/if}
                </span>
                {#if !contactInfo.phone}
                  <button
                    class="btn btn-ghost btn-sm"
                    on:click={() => fetchContactInfo('phone')}
                    disabled={isLoading}
                  >
                    {#if isLoading}
                      <Icon icon="material-symbols:sync-outline" class="h-5 w-5 animate-spin" />
                    {:else}
                      <Icon icon="material-symbols:visibility" class="h-5 w-5" />
                    {/if}
                  </button>
                {/if}
              </div>
            {/if}

            {#if listing.hasEmail}
              <div class="flex w-[250px] items-center gap-1">
                <Icon icon="material-symbols:mail" class="h-5 w-5 text-primary" />
                <span class="font-mono">
                  {#if contactInfo.email}
                    {contactInfo.email}
                  {:else}
                    ***@***.***
                  {/if}
                </span>
                {#if !contactInfo.email}
                  <button
                    class="btn btn-ghost btn-sm"
                    on:click={() => fetchContactInfo('email')}
                    disabled={isLoading}
                  >
                    {#if isLoading}
                      <Icon icon="material-symbols:sync-outline" class="h-5 w-5 animate-spin" />
                    {:else}
                      <Icon icon="material-symbols:visibility" class="h-5 w-5" />
                    {/if}
                  </button>
                {/if}
              </div>
            {/if}

            {#if showLoginPrompt}
              <div class="mt-4 rounded-lg border border-info bg-info/10 p-4">
                <div class="flex items-start gap-3">
                  <Icon
                    icon="material-symbols:info"
                    class="mt-0.5 h-6 w-6 flex-shrink-0 text-info"
                  />
                  <div class="flex-1">
                    <p class="mb-2 font-medium text-info">Login Required</p>
                    <p class="mb-3 text-sm text-gray-600">
                      Please log in to view contact information.
                    </p>
                    <button class="btn btn-primary btn-sm" on:click={handleLogin}>
                      <Icon icon="material-symbols:login" class="mr-2 h-4 w-4" />
                      Log In
                    </button>
                  </div>
                  <button class="btn btn-ghost btn-sm" on:click={() => (showLoginPrompt = false)}>
                    <Icon icon="material-symbols:close" class="h-4 w-4" />
                  </button>
                </div>
              </div>
            {:else if error}
              <div class="mt-2 flex items-center gap-1 text-sm text-error">
                <Icon icon="material-symbols:error" class="h-5 w-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      {#if !isOwner && hasRevealedContact}
        <div class="mt-6 rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm">
          <div class="mb-4 flex items-center gap-2">
            <Icon icon="material-symbols:reviews" class="h-6 w-6 text-primary" />
            <h2 class="text-xl font-semibold">Leave buyer feedback</h2>
          </div>

          <p class="mb-4 text-sm text-base-content/70">
            After you reveal the seller’s contact information, you can leave a quick rating and
            optional note.
          </p>

          <div class="mb-4 flex flex-wrap gap-2">
            {#each [1, 2, 3, 4, 5] as rating (rating)}
              <button
                type="button"
                class="btn btn-sm {feedbackRating === rating ? 'btn-primary' : 'btn-outline'}"
                on:click={() => (feedbackRating = rating)}
              >
                {rating} star{rating > 1 ? 's' : ''}
              </button>
            {/each}
          </div>

          <textarea
            class="textarea textarea-bordered min-h-[120px] w-full"
            placeholder="Share a short note about your experience with this seller (optional)"
            bind:value={feedbackComment}
          ></textarea>

          {#if feedbackError}
            <div class="mt-3 flex items-center gap-2 text-sm text-error">
              <Icon icon="material-symbols:error" class="h-5 w-5" />
              <span>{feedbackError}</span>
            </div>
          {/if}

          {#if feedbackSuccess}
            <div class="mt-3 flex items-center gap-2 text-sm text-success">
              <Icon icon="material-symbols:check-circle" class="h-5 w-5" />
              <span>{feedbackSuccess}</span>
            </div>
          {/if}

          <div class="mt-4">
            <button
              class="btn btn-primary"
              on:click={submitFeedback}
              disabled={isSubmittingFeedback}
            >
              {#if isSubmittingFeedback}
                <Icon icon="material-symbols:sync-outline" class="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              {:else}
                <Icon icon="material-symbols:send" class="mr-2 h-5 w-5" />
                Submit Feedback
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Relevant Listings Section -->
  <RelevantListings {listing} />
</div>

<!-- Delete Confirmation Modal -->
<dialog id="delete-modal" class="modal modal-bottom sm:modal-middle">
  <div class="modal-box">
    <h3 class="text-lg font-bold">Confirm Deletion</h3>
    <p class="py-4">
      Are you sure you want to delete "{listingToDelete?.title}"? This action cannot be undone.
    </p>
    {#if deleteError}
      <div class="alert alert-error mb-4">
        <Icon icon="material-symbols:error" class="h-5 w-5" />
        <span>{deleteError}</span>
      </div>
    {/if}
    <div class="modal-action">
      <form method="dialog">
        <div class="flex gap-2">
          <button class="btn" disabled={isDeleting}>Cancel</button>
          <button
            class="btn btn-error"
            on:click|preventDefault={handleDelete}
            disabled={isDeleting}
          >
            {#if isDeleting}
              <Icon icon="material-symbols:hourglass-bottom" class="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            {:else}
              Delete
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
    {#if statusError}
      <div class="alert alert-error mb-4">
        <Icon icon="material-symbols:error" class="h-5 w-5" />
        <span>{statusError}</span>
      </div>
    {/if}
    <div class="modal-action">
      <form method="dialog">
        <div class="flex gap-2">
          <button class="btn" disabled={isUpdatingStatus}>Cancel</button>
          <button
            class="btn {listingToUpdateStatus?.newStatus === 'DRAFT'
              ? 'btn-warning'
              : 'btn-success'}"
            on:click|preventDefault={handleStatusUpdate}
            disabled={isUpdatingStatus}
          >
            {#if isUpdatingStatus}
              <Icon icon="material-symbols:hourglass-bottom" class="mr-2 h-4 w-4 animate-spin" />
              {listingToUpdateStatus?.newStatus === 'DRAFT' ? 'Pausing...' : 'Activating...'}
            {:else}
              {listingToUpdateStatus?.newStatus === 'DRAFT' ? 'Pause' : 'Activate'}
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
    {#if statusError}
      <div class="alert alert-error mb-4">
        <Icon icon="material-symbols:error" class="h-5 w-5" />
        <span>{statusError}</span>
      </div>
    {/if}
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
