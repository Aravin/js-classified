<script lang="ts">
  import SearchableSelect from '$lib/SearchableSelect.svelte';
  import { locations } from '$lib/locations';
  import { categories } from '$lib/categories/categories';
  import Icon from '@iconify/svelte';
  import { containsBadWords } from '$lib/badwords';
  import { onMount, onDestroy } from 'svelte';
  import { beforeNavigate } from '$app/navigation';

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
    location: '',
    category: '',
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

  const locationOptions = locations.map((loc) => ({
    key: loc.key,
    value: loc.value,
    display: loc.display
  }));

  const categoryOptions = categories.map((category) => ({
    key: category.key,
    value: category.value,
    display: category.display
  }));

  function validateTitle(): void {
    if (!formData.title) {
      errors.title = 'Title is required';
    } else if (formData.title.length < 10) {
      errors.title = 'Title must be at least 10 characters';
    } else if (formData.title.length > 70) {
      errors.title = 'Title must not exceed 70 characters';
    } else {
      const badWordsCheck = containsBadWords(formData.title);
      if (badWordsCheck.hasBadWords) {
        errors.title = `Title contains inappropriate words: ${badWordsCheck.foundWords.join(', ')}`;
      } else {
        errors.title = '';
      }
    }
  }

  function validateDescription(): void {
    if (!formData.description) {
      errors.description = 'Description is required';
    } else if (formData.description.length > 500) {
      errors.description = 'Description must not exceed 500 characters';
    } else {
      const badWordsCheck = containsBadWords(formData.description);
      if (badWordsCheck.hasBadWords) {
        errors.description = `Description contains inappropriate words: ${badWordsCheck.foundWords.join(', ')}`;
      } else {
        errors.description = '';
      }
    }
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

    // Title validation (10-70 characters)
    if (!formData.title) {
      errors.title = 'Title is required';
      isValid = false;
    } else if (formData.title.length < 10) {
      errors.title = 'Title must be at least 10 characters';
      isValid = false;
    } else if (formData.title.length > 70) {
      errors.title = 'Title must not exceed 70 characters';
      isValid = false;
    }

    // Description validation (max 500 characters)
    if (!formData.description) {
      errors.description = 'Description is required';
      isValid = false;
    } else if (formData.description.length > 500) {
      errors.description = 'Description must not exceed 500 characters';
      isValid = false;
    }

    // Price validation (0-999999)
    const priceNum = Number(formData.price);
    if (!formData.price) {
      errors.price = 'Price is required';
      isValid = false;
    } else if (isNaN(priceNum) || priceNum < 0) {
      errors.price = 'Price must be 0 or greater';
      isValid = false;
    } else if (priceNum > 999999) {
      errors.price = 'Price must not exceed 999,999';
      isValid = false;
    }

    // Location validation
    if (!formData.location) {
      errors.location = 'Location is required';
      isValid = false;
    }

    // Category validation
    if (!formData.category) {
      errors.category = 'Category is required';
      isValid = false;
    }

    // Email or Phone validation (at least one required)
    if (!formData.email && !formData.phone) {
      errors.email = 'Either email or phone is required';
      errors.phone = 'Either email or phone is required';
      isValid = false;
    } else {
      // Validate email if provided
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
        isValid = false;
      }
      // Validate phone if provided
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

 async function handleSubmit(): Promise<void> {
   if (validateForm()) {
     try {
       // Find the location and category IDs based on selected values
       const selectedLocation = locationOptions.find(loc => loc.value === formData.location);
       const selectedCategory = categoryOptions.find(cat => cat.value === formData.category);
       
       const payload = {
         title: formData.title,
         description: formData.description,
         price: Number(formData.price),
         categoryId: selectedCategory?.key ?? 1,
         locationId: selectedLocation?.key ?? 1,
         contactInfo: {
           email: formData.email,
           phone: formData.phone
         }
       };
 
       const response = await fetch('http://localhost:8080/api/listings', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify(payload)
       });
 
       if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
       }
 
       const result = await response.json();
       console.log('Listing created successfully:', result);
       
       // TODO: Add success notification and redirect to the listing page
       // You might want to use Svelte's goto function to redirect
       
     } catch (error) {
       console.error('Error submitting form:', error);
       // TODO: Add error notification to the user
     }
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
      <div class="error-container">
        {#if errors.title}
          <span class="label-text-alt text-error">{errors.title}</span>
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
      <div class="error-container">
        {#if errors.description}
          <span class="label-text-alt text-error">{errors.description}</span>
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
      <div class="error-container">
        {#if errors.price}
          <span class="label-text-alt text-error">{errors.price}</span>
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
          options={locationOptions}
          bind:searchTerm={formData.location}
          placeholder="Select location"
          icon="material-symbols:location-on"
          on:blur={validateLocation}
          error={!!errors.location}
        />
        <div class="error-container">
          {#if errors.location}
            <span class="label-text-alt text-error">{errors.location}</span>
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
          options={categoryOptions}
          bind:searchTerm={formData.category}
          placeholder="Select category"
          icon="material-symbols:category"
          on:blur={validateCategory}
          error={!!errors.category}
        />
        <div class="error-container">
          {#if errors.category}
            <span class="label-text-alt text-error">{errors.category}</span>
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
        pattern="[0-9]{10}"
        on:blur={validateContact}
      />
      <div class="error-container">
        {#if errors.phone}
          <span class="label-text-alt text-error">{errors.phone}</span>
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
      <div class="error-container">
        {#if errors.email}
          <span class="label-text-alt text-error">{errors.email}</span>
        {/if}
      </div>
    </div>

    <!-- Submit Button -->
    <div class="form-control mt-8">
      <button type="submit" class="btn btn-primary" disabled={!isFormValid}>
        <Icon icon="material-symbols:post-add" class="w-5 h-5 mr-2" />
        Post Ad
      </button>
    </div>
  </form>
</div>