<script lang="ts">
  import SearchableSelect from '$lib/SearchableSelect.svelte';
  import { locations } from '$lib/locations';
  import { categories } from '$lib/categories/categories';
  import Icon from '@iconify/svelte';
  import { onMount, onDestroy } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { goto } from '$app/navigation';
  import { config } from '$lib/config';
  import { selectedLocation, selectedCategory } from '$lib/stores/filters';
  import { user, isAuthenticated, getAuthHeaders } from '$lib/auth/auth0';
  import {
    type FormData,
    type FormErrors,
    initialFormData,
    initialErrors,
    validateTitle,
    validateDescription,
    validatePrice,
    validateLocation,
    validateCategory,
    validateContact,
    validateForm,
    sanitizeInput,
    hasFormChanges
  } from '$lib/form-validation';
  import { browser } from '$app/environment';
  import { checkActiveAdsLimit } from '$lib/utils';

  /** @type {import('./$types').PageData} */
  export let data;

  // Initialize form data with store values
  let formData: FormData = {
    ...initialFormData,
    location: $selectedLocation,
    category: $selectedCategory
  };
  
  let errors: FormErrors = { ...initialErrors };
  let isFormDirty = false;

  // Update formData when stores change
  $: formData.location = $selectedLocation;
  $: formData.category = $selectedCategory;

  // Update stores when formData changes
  $: $selectedLocation = formData.location;
  $: $selectedCategory = formData.category;

  let submitting = false;
  let submitError: string | null = null;
  let draftListing: any = null;
  let isLoading = true;
  let limitWarning: string | null = null;

  async function handleSubmit(): Promise<void> {
    const validation = validateForm(formData);
    if (!validation.isValid) {
      errors = validation.errors;
      submitError = 'Please fix the validation errors before submitting.';
      return;
    }

    submitting = true;
    submitError = null;

    try {
      const selectedLocation = locations.find(loc => loc.value === formData.location);
      const selectedCategory = categories.find(cat => cat.value === formData.category);
      
      if (!selectedLocation || !selectedCategory) {
        throw new Error('Invalid location or category selected');
      }

      const payload = {
        title: sanitizeInput(formData.title),
        description: sanitizeInput(formData.description),
        price: formData.price ? Number(formData.price) : undefined,
        categoryId: selectedCategory.key,
        locationId: selectedLocation.key,
        email: formData.email ? sanitizeInput(formData.email) : undefined,
        phone: formData.phone ? sanitizeInput(formData.phone) : undefined,
        status: 'draft',
        ...$user ? { authUserId: $user.sub } : {}
      };

      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${config.api.baseUrl}/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to submit listing');
      }

      draftListing = responseData;
      isFormDirty = false;
      await goto('/post-ad/preview?id=' + responseData.id);
    } catch (err) {
      console.error('Error submitting listing:', err);
      submitError = err instanceof Error ? err.message : 'Failed to submit listing';
    } finally {
      submitting = false;
    }
  }

  // Handle navigation attempts
  beforeNavigate(({ cancel }) => {
    if (isFormDirty && hasFormChanges(formData, initialFormData) && 
        !window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
      cancel();
    }
  });

  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (isFormDirty && hasFormChanges(formData, initialFormData)) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  onMount(async () => {
    if (browser) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    
    // Check active ads limit on mount
    if ($user?.sub && $isAuthenticated) {
      const limitCheck = await checkActiveAdsLimit($user.sub);
      if (limitCheck.hasReachedLimit) {
        limitWarning = `You currently have ${limitCheck.activeCount} active ad${limitCheck.activeCount > 1 ? 's' : ''}. You are allowed to have only ${config.user.maxActiveAds} active ad${config.user.maxActiveAds > 1 ? 's' : ''}. Your listing will be saved as draft. To publish more ads, please contact us.`;
      }
    }
    
    isLoading = false;
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  });
</script>

<svelte:head>
  <title>Post a Free Ad | locful</title>
  <meta name="description" content="Post a free classified ad on locful.com. Sell anything — electronics, vehicles, real estate, jobs and more in your local area." />
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-3xl">
  {#if isLoading}
    <div class="flex justify-center items-center min-h-[50vh]">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if !$isAuthenticated}
    <div class="text-center py-12">
      <h2 class="text-2xl font-bold mb-4">Authentication Required</h2>
      <p class="text-gray-600 mb-6">Please sign in to post an advertisement</p>
      <a href="/" class="btn btn-primary">Go to Home</a>
    </div>
  {:else}
    <h1 class="text-3xl font-bold mb-8 text-center">Post Your Ad</h1>

    {#if limitWarning}
      <div class="alert alert-warning mb-6">
        <Icon icon="material-symbols:warning" class="w-5 h-5" />
        <span>{limitWarning}</span>
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <!-- Title -->
      <div class="form-control">
        <label class="label" for="title">
          <span class="label-text">Title</span>
          <span class="label-text-alt">{formData.title.length}/70</span>
        </label>
        <input
          type="text"
          id="title"
          bind:value={formData.title}
          class="input input-bordered w-full"
          class:input-error={errors.title}
          on:blur={() => errors.title = validateTitle(formData.title)}
          maxlength="70"
        />
        {#if errors.title}
          <label class="label">
            <span class="label-text-alt text-error">{errors.title}</span>
          </label>
        {/if}
      </div>

      <!-- Description -->
      <div class="form-control">
        <label class="label" for="description">
          <span class="label-text">Description</span>
          <span class="label-text-alt">{formData.description.length}/500</span>
        </label>
        <textarea
          id="description"
          bind:value={formData.description}
          class="textarea textarea-bordered h-32"
          class:textarea-error={errors.description}
          on:blur={() => errors.description = validateDescription(formData.description)}
          maxlength="500"
        />
        {#if errors.description}
          <label class="label">
            <span class="label-text-alt text-error">{errors.description}</span>
          </label>
        {/if}
      </div>

      <!-- Price -->
      <div class="form-control">
        <label class="label" for="price">
          <span class="label-text">Price (₹)</span>
        </label>
        <input
          type="number"
          id="price"
          bind:value={formData.price}
          class="input input-bordered"
          class:input-error={errors.price}
          on:blur={() => errors.price = validatePrice(formData.price)}
          min="0"
          max="999999"
        />
        {#if errors.price}
          <label class="label">
            <span class="label-text-alt text-error">{errors.price}</span>
          </label>
        {/if}
      </div>

      <!-- Location -->
      <div class="form-control">
        <label class="label" for="location">
          <span class="label-text">Location</span>
        </label>
        <SearchableSelect
          options={locations}
          bind:searchTerm={formData.location}
          placeholder="Select location"
          icon="material-symbols:location-on"
          on:blur={() => errors.location = validateLocation(formData.location)}
          error={!!errors.location}
        />
        {#if errors.location}
          <label class="label">
            <span class="label-text-alt text-error">{errors.location}</span>
          </label>
        {/if}
      </div>

      <!-- Category -->
      <div class="form-control">
        <label class="label" for="category">
          <span class="label-text">Category</span>
        </label>
        <SearchableSelect
          options={categories}
          bind:searchTerm={formData.category}
          placeholder="Select category"
          icon="material-symbols:category"
          on:blur={() => errors.category = validateCategory(formData.category)}
          error={!!errors.category}
        />
        {#if errors.category}
          <label class="label">
            <span class="label-text-alt text-error">{errors.category}</span>
          </label>
        {/if}
      </div>

      <!-- Contact Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Phone -->
        <div class="form-control">
          <label class="label" for="phone">
            <span class="label-text">Phone</span>
          </label>
          <input
            type="tel"
            id="phone"
            bind:value={formData.phone}
            class="input input-bordered"
            class:input-error={errors.phone}
            on:blur={() => {
              const contactErrors = validateContact(formData.email, formData.phone);
              errors.phone = contactErrors.phone;
              errors.email = contactErrors.email;
            }}
            maxlength="10"
            inputmode="numeric"
          />
          {#if errors.phone}
            <label class="label">
              <span class="label-text-alt text-error">{errors.phone}</span>
            </label>
          {/if}
        </div>

        <!-- Email -->
        <div class="form-control">
          <label class="label" for="email">
            <span class="label-text">Email</span>
          </label>
          <input
            type="email"
            id="email"
            bind:value={formData.email}
            class="input input-bordered"
            class:input-error={errors.email}
            on:blur={() => {
              const contactErrors = validateContact(formData.email, formData.phone);
              errors.phone = contactErrors.phone;
              errors.email = contactErrors.email;
            }}
          />
          {#if errors.email}
            <label class="label">
              <span class="label-text-alt text-error">{errors.email}</span>
            </label>
          {/if}
        </div>
      </div>

      <!-- Submit Button -->
      <div class="form-control mt-6">
        <button 
          type="submit" 
          class="btn btn-primary" 
          disabled={submitting}
        >
          {#if submitting}
            <Icon icon="material-symbols:hourglass-bottom" class="w-5 h-5 mr-2 animate-spin" />
            Submitting...
          {:else}
            <Icon icon="material-symbols:post-add" class="w-5 h-5 mr-2" />
            Post Ad
          {/if}
        </button>
        {#if limitWarning}
          <div class="alert alert-info mt-4">
            <Icon icon="material-symbols:info" class="w-5 h-5" />
            <span>Your listing will be saved as <strong>DRAFT</strong>. You can publish it later from the preview page or your ads list.</span>
          </div>
        {/if}
        {#if submitError}
          <div class="alert alert-error mt-4">
            <Icon icon="material-symbols:error" class="w-5 h-5" />
            <span>{submitError}</span>
          </div>
        {/if}
      </div>
    </form>
  {/if}
</div>
