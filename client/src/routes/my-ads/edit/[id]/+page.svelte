<script lang="ts">
  import SearchableSelect from '$lib/SearchableSelect.svelte';
  import { locations } from '$lib/locations';
  import { categories } from '$lib/categories/categories';
  import Icon from '@iconify/svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { config } from '$lib/config';
  import { selectedLocation, selectedCategory } from '$lib/stores/filters';
  import { user, isAuthenticated } from '$lib/auth/auth0';
  import { page } from '$app/stores';
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
    sanitizeInput
  } from '$lib/form-validation';

  const listingId = $page.params.id;
  let loading = true;
  let loadError: string | null = null;
  let submitting = false;
  let submitError: string | null = null;

  let formData: FormData = { ...initialFormData };
  let errors: FormErrors = { ...initialErrors };

  // Update formData when stores change
  $: formData.location = $selectedLocation;
  $: formData.category = $selectedCategory;

  // Update stores when formData changes
  $: $selectedLocation = formData.location;
  $: $selectedCategory = formData.category;

  // Load existing listing data
  async function loadListingData() {
    try {
      const response = await fetch(`${config.api.baseUrl}/listings/${listingId}?showContact=true`);
      if (!response.ok) {
        throw new Error('Failed to load listing');
      }

      const listing = await response.json();
      const locationObj = locations.find(loc => loc.key === listing.locationId);
      const categoryObj = categories.find(cat => cat.key === listing.categoryId);

      formData = {
        title: listing.title,
        description: listing.description,
        price: listing.price?.toString() || '',
        location: locationObj?.value || '',
        category: categoryObj?.value || '',
        phone: listing.phone || '',
        email: listing.email || ''
      };

      loading = false;
    } catch (err) {
      console.error('Error loading listing:', err);
      loadError = err instanceof Error ? err.message : 'Failed to load listing';
      loading = false;
    }
  }

  async function handleSubmit() {
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
        phone: formData.phone ? sanitizeInput(formData.phone) : undefined
      };

      const response = await fetch(`${config.api.baseUrl}/listings/${listingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update listing');
      }

      const updatedListing = await response.json();
      await goto(`/list/${updatedListing.slug}`);
    } catch (err) {
      console.error('Error updating listing:', err);
      submitError = err instanceof Error ? err.message : 'Failed to update listing';
    } finally {
      submitting = false;
    }
  }

  onMount(async () => {
    if (!$isAuthenticated) {
      goto('/');
      return;
    }
    await loadListingData();
  });
</script>

<div class="container mx-auto px-4 py-8 max-w-3xl">
  <h1 class="text-3xl font-bold mb-8 text-center">Edit Your Ad</h1>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <Icon icon="material-symbols:hourglass-bottom" class="w-8 h-8 animate-spin" />
    </div>
  {:else if loadError}
    <div class="alert alert-error">
      <Icon icon="material-symbols:error" class="w-6 h-6" />
      <span>{loadError}</span>
    </div>
  {:else}
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
            Updating...
          {:else}
            <Icon icon="material-symbols:edit-document" class="w-5 h-5 mr-2" />
            Update Ad
          {/if}
        </button>
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