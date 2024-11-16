<script lang="ts">
  import SearchableSelect from '$lib/SearchableSelect.svelte';
  import { locations } from '$lib/locations';
  import { categories } from '$lib/categories/categories';
  import Icon from '@iconify/svelte';
  import { containsBadWords } from '$lib/badwords';
  import { onMount, onDestroy } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { goto } from '$app/navigation';
  import DOMPurify from 'dompurify';
  import {config} from '$lib/config';
  import { selectedLocation, selectedCategory } from '$lib/stores/filters';

  /** @type {import('./$types').PageData} */
  export let data;

  interface FormData {
    title: string;
    description: string;
    price: string;
    location: string;
    category: string;
    phone: string;
    email: string;
  }

  interface FormErrors {
    title: string;
    description: string;
    price: string;
    location: string;
    category: string;
    phone: string;
    email: string;
  }

  let formData: FormData = {
    title: '',
    description: '',
    price: '',
    location: $selectedLocation,
    category: $selectedCategory,
    phone: '',
    email: ''
  };

  let errors: FormErrors = {
    title: '',
    description: '',
    price: '',
    location: '',
    category: '',
    phone: '',
    email: ''
  };

  let isFormDirty = false;

  // Track form changes
  $: isFormDirty = formData.title !== '' ||
                   formData.description !== '' ||
                   formData.price !== '' ||
                   formData.location !== '' ||
                   formData.category !== '' ||
                   formData.phone !== '' ||
                   formData.email !== '';

  // Update formData when stores change
  $: formData.location = $selectedLocation;
  $: formData.category = $selectedCategory;

  // Update stores when formData changes
  $: $selectedLocation = formData.location;
  $: $selectedCategory = formData.category;

  // Validation utilities
  function sanitizeInput(input: string): string {
    // Use DOMPurify to prevent XSS
    return DOMPurify.sanitize(input.trim(), {
      ALLOWED_TAGS: [], // Strip all HTML tags
      ALLOWED_ATTR: [] // Strip all attributes
    });
  }

  function isValidAlphanumericTitle(title: string): boolean {
    // Title must start with a letter or number and can contain spaces and basic punctuation
    return /^[a-zA-Z0-9][a-zA-Z0-9\s.,!?-]*$/.test(title);
  }

  function validateTitle(): void {
    const sanitizedTitle = sanitizeInput(formData.title);
    
    if (!sanitizedTitle) {
      errors.title = 'Title is required';
      return;
    }

    if (sanitizedTitle.length < 10 || sanitizedTitle.length > 70) {
      errors.title = 'Title must be between 10 and 70 characters';
      return;
    }

    if (!isValidAlphanumericTitle(sanitizedTitle)) {
      errors.title = 'Title must start with a letter or number and contain only alphanumeric characters, spaces, and basic punctuation';
      return;
    }

    const titleCheck = containsBadWords(sanitizedTitle);
    if (titleCheck.hasBadWords) {
      errors.title = 'Title contains inappropriate content';
      return;
    }

    errors.title = '';
    formData.title = sanitizedTitle; // Update with sanitized value
  }

  function validateDescription(): void {
    const sanitizedDesc = sanitizeInput(formData.description);
    
    if (!sanitizedDesc) {
      errors.description = 'Description is required';
      return;
    }

    if (sanitizedDesc.length > 500) {
      errors.description = 'Description must not exceed 500 characters';
      return;
    }

    const descCheck = containsBadWords(sanitizedDesc);
    if (descCheck.hasBadWords) {
      errors.description = 'Description contains inappropriate content';
      return;
    }

    errors.description = '';
    formData.description = sanitizedDesc; // Update with sanitized value
  }

  function validatePrice(): void {
    const priceNum = Number(formData.price);
    if (!formData.price) {
      errors.price = 'Price is required';
    } else if (isNaN(priceNum) || priceNum < 0) {
      errors.price = 'Price must be 0 or greater';
    } else if (priceNum > 999999) {
      errors.price = 'Price must not exceed 999,999';
    } else {
      errors.price = '';
    }
  }

  function validateLocation(): void {
    if (!formData.location) {
      errors.location = 'Location is required';
    } else {
      errors.location = '';
    }
  }

  function validateCategory(): void {
    if (!formData.category) {
      errors.category = 'Category is required';
    } else {
      errors.category = '';
    }
  }

  function validateContact(): void {
    if (!formData.email && !formData.phone) {
      errors.email = 'Either email or phone is required';
      errors.phone = 'Either email or phone is required';
    } else {
      errors.email = '';
      errors.phone = '';
      
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
      
      if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
        errors.phone = 'Please enter a valid 10-digit phone number';
      }
    }
  }

  function validateForm(): boolean {
    let isValid = true;
    errors = {
      title: '',
      description: '',
      price: '',
      location: '',
      category: '',
      phone: '',
      email: ''
    };

    // Validate title
    const sanitizedTitle = sanitizeInput(formData.title);
    if (!sanitizedTitle || !isValidAlphanumericTitle(sanitizedTitle) || 
        sanitizedTitle.length < 10 || sanitizedTitle.length > 70) {
      errors.title = 'Title must be between 10 and 70 characters and start with a letter or number';
      isValid = false;
    }

    // Validate description
    const sanitizedDesc = sanitizeInput(formData.description);
    if (!sanitizedDesc || sanitizedDesc.length === 0 || sanitizedDesc.length > 500) {
      errors.description = 'Description is required and must not exceed 500 characters';
      isValid = false;
    }

    // Price validation
    if (!formData.price || Number(formData.price) < 0 || Number(formData.price) > 999999) {
      errors.price = 'Please enter a valid price between 0 and 999,999';
      isValid = false;
    }

    if (!formData.location) {
      errors.location = 'Location is required';
      isValid = false;
    }

    if (!formData.category) {
      errors.category = 'Category is required';
      isValid = false;
    }

    // Check for bad words
    const titleCheck = containsBadWords(sanitizedTitle);
    const descriptionCheck = containsBadWords(sanitizedDesc);

    if (titleCheck.hasBadWords) {
      errors.title = 'Title contains inappropriate content';
      isValid = false;
    }

    if (descriptionCheck.hasBadWords) {
      errors.description = 'Description contains inappropriate content';
      isValid = false;
    }

    // Email/Phone validation
    if (!formData.email && !formData.phone) {
      errors.email = 'Either email or phone is required';
      errors.phone = 'Either email or phone is required';
      isValid = false;
    } else {
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
        isValid = false;
      }
      if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
        errors.phone = 'Please enter a valid 10-digit phone number';
        isValid = false;
      }
    }

    return isValid;
  }

  // Reactive validation
  $: isFormValid = formData.title.length >= 10 && 
                   formData.title.length <= 70 && 
                   formData.description.length <= 500 && 
                   formData.description.length > 0 &&
                   Number(formData.price) >= 0 && 
                   Number(formData.price) <= 999999 &&
                   formData.location &&
                   formData.category &&
                   (formData.email || formData.phone) &&
                   (!formData.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) &&
                   (!formData.phone || /^\d{10}$/.test(formData.phone)) &&
                   !containsBadWords(formData.title).hasBadWords &&
                   !containsBadWords(formData.description).hasBadWords;

  let submitting = false;
  let submitError: string | null = null;

  async function handleSubmit(): Promise<void> {
    if (!validateForm()) {
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
        price: Number(formData.price),
        categoryId: selectedCategory.key,
        locationId: selectedLocation.key,
        email: formData.email,
        phone: formData.phone,
        images: []
      };

      // Use fetch from SvelteKit
      const response = await fetch(`${config.api.baseUrl}/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors', // explicitly set CORS mode
        credentials: 'omit', // don't send credentials
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (response.status !== 201) {
        throw new Error(result.message || 'Failed to create listing');
      }

      if (!result.id || !result.slug) {
        throw new Error('Invalid response from server');
      }

      await goto(`/list/${result.slug}?id=${result.id}`);
    } catch (error) {
      console.error('Error submitting form:', error);
      submitError = error instanceof Error ? error.message : 'An unexpected error occurred';
    } finally {
      submitting = false;
    }
  }

  // Handle navigation attempts
  beforeNavigate(({ cancel, to }) => {
    if (isFormDirty && !window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
      cancel();
    }
  });

  // Handle browser back/forward/refresh
  onMount(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  onDestroy(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (isFormDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  }
</script>

<style>
  .error-container {
    min-height: 1rem;
    margin-top: 0.125rem;
  }
  .label-text-alt.text-error {
    font-size: 0.75rem;
    line-height: 1rem;
  }
</style>

<div class="container mx-auto px-4 py-8 max-w-3xl">
  <h1 class="text-3xl font-bold mb-8 text-center">Post Your Ad</h1>

  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
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
        class="input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-primary {errors.title ? 'ring-2 ring-error' : ''}"
        placeholder="Enter ad title"
        on:blur={validateTitle}
        maxlength="70"
      />
      <div class="error-container mt-4">
        {#if errors.title}
          <div class="flex items-center gap-2 text-error">
            <Icon icon="material-symbols:error" class="w-5 h-5" />
            <span class="text-sm font-medium">{errors.title}</span>
          </div>
        {/if}
      </div>
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
        class="textarea textarea-bordered w-full h-64 min-h-[16rem] focus:outline-none focus:ring-2 focus:ring-primary {errors.description ? 'ring-2 ring-error' : ''}"
        placeholder="Describe your item's condition, features, and any other relevant details"
        on:blur={validateDescription}
        maxlength="500"
        aria-describedby="description-hint"
      ></textarea>
      <div class="error-container mt-4">
        {#if errors.description}
          <div class="flex items-center gap-2 text-error">
            <Icon icon="material-symbols:error" class="w-5 h-5" />
            <span class="text-sm font-medium">{errors.description}</span>
          </div>
        {/if}
      </div>
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
        class="input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-primary {errors.price ? 'ring-2 ring-error' : ''}"
        placeholder="Enter price"
        min="0"
        max="999999"
        on:blur={validatePrice}
      />
      <div class="error-container mt-4">
        {#if errors.price}
          <div class="flex items-center gap-2 text-error">
            <Icon icon="material-symbols:error" class="w-5 h-5" />
            <span class="text-sm font-medium">{errors.price}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Location -->
    <div class="form-control">
      <label class="label" for="location">
        <span class="label-text">Location</span>
      </label>
      <div class="w-full">
        <SearchableSelect
          options={locations}
          bind:searchTerm={formData.location}
          placeholder="Select location"
          icon="material-symbols:location-on"
          on:blur={validateLocation}
          error={!!errors.location}
        />
        <div class="error-container mt-4">
          {#if errors.location}
            <div class="flex items-center gap-2 text-error">
              <Icon icon="material-symbols:error" class="w-5 h-5" />
              <span class="text-sm font-medium">{errors.location}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Category -->
    <div class="form-control">
      <label class="label" for="category">
        <span class="label-text">Category</span>
      </label>
      <div class="w-full">
        <SearchableSelect
          options={categories}
          bind:searchTerm={formData.category}
          placeholder="Select category"
          icon="material-symbols:category"
          on:blur={validateCategory}
          error={!!errors.category}
        />
        <div class="error-container mt-4">
          {#if errors.category}
            <div class="flex items-center gap-2 text-error">
              <Icon icon="material-symbols:error" class="w-5 h-5" />
              <span class="text-sm font-medium">{errors.category}</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Phone -->
    <div class="form-control">
      <label class="label" for="phone">
        <span class="label-text">Phone Number</span>
      </label>
      <input
        type="tel"
        id="phone"
        bind:value={formData.phone}
        class="input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-primary {errors.phone ? 'ring-2 ring-error' : ''}"
        placeholder="Enter 10-digit phone number"
        maxlength="10"
        inputmode="numeric"
        on:blur={validateContact}
      />
      <div class="error-container mt-4">
        {#if errors.phone}
          <div class="flex items-center gap-2 text-error">
            <Icon icon="material-symbols:error" class="w-5 h-5" />
            <span class="text-sm font-medium">{errors.phone}</span>
          </div>
        {/if}
      </div>
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
        class="input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-primary {errors.email ? 'ring-2 ring-error' : ''}"
        placeholder="Enter email address"
        on:blur={validateContact}
      />
      <div class="error-container mt-4">
        {#if errors.email}
          <div class="flex items-center gap-2 text-error">
            <Icon icon="material-symbols:error" class="w-5 h-5" />
            <span class="text-sm font-medium">{errors.email}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Submit Button -->
    <div class="form-control mt-8">
      <button type="submit" class="btn btn-primary" disabled={!isFormValid || submitting}>
        {#if submitting}
          <Icon icon="material-symbols:hourglass-bottom" class="w-5 h-5 mr-2 animate-spin" />
        {:else}
          <Icon icon="material-symbols:post-add" class="w-5 h-5 mr-2" />
        {/if}
        {#if submitting}
          Submitting...
        {:else}
          Post Ad
        {/if}
      </button>
      {#if submitError}
        <div class="error-container mt-4">
          <div class="flex items-center gap-2 text-error">
            <Icon icon="material-symbols:error" class="w-5 h-5" />
            <span class="text-sm font-medium">{submitError}</span>
          </div>
        </div>
      {/if}
    </div>
  </form>
</div>