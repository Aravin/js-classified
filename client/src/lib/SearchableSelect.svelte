<script lang="ts">
  import Icon from '@iconify/svelte';
  import { createEventDispatcher as createDispatch } from 'svelte';
  const dispatch = createDispatch<{
    blur: void;
  }>();

  export let options: { key: number, value: string, display: string }[] = [];
  export let searchTerm: string = '';
  export let placeholder: string = '';
  export let showDropdown: boolean = false;
  export let icon: string = '';
  export let error: boolean = false;

  let displayTerm: string = '';
  let isSearching: boolean = false;
  let dropdownId = `dropdown-${Math.random().toString(36).substr(2, 9)}`;
  let activeIndex = -1;

  function handleFocus() {
    showDropdown = true;
    isSearching = true;
  }

  function handleBlur() {
    setTimeout(() => {
      showDropdown = false;
      isSearching = false;
      const selectedOption = options.find(opt => opt.value === searchTerm);
      displayTerm = selectedOption ? selectedOption.value : '';
      dispatch('blur');
      activeIndex = -1;
    }, 100);
  }

  function selectOption(option: { key: number, value: string, display: string }) {
    searchTerm = option.value;
    displayTerm = option.value;
    showDropdown = false;
    isSearching = false;
    activeIndex = -1;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!showDropdown) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, options.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (activeIndex >= 0) {
          selectOption(options[activeIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        showDropdown = false;
        activeIndex = -1;
        break;
    }
  }

  $: filteredOptions = options.filter(option => 
    option.display.toLowerCase().includes(displayTerm.toLowerCase()) ||
    option.value.toLowerCase().includes(displayTerm.toLowerCase())
  );

  // Initialize display term with selected value
  $: if (!isSearching && searchTerm) {
    const selectedOption = options.find(opt => opt.value === searchTerm);
    if (selectedOption && !displayTerm) {
      displayTerm = selectedOption.value;
    }
  }
</script>

<style>
  .searchable-select-container {
    position: relative;
    width: 100%;
  }
  
  .input-group {
    position: relative;
  }
  
  .input-group input {
    width: 100%;
    padding-left: 56px;
  }
  
  .input-group button {
    position: absolute;
    left: 0;
    top: 0;
  }
  
  .dropdown-options {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 0.5rem;
    margin-top: 0.25rem;
    max-height: 200px;
    overflow-y: auto;
    z-index: 50;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }

  .dropdown-option {
    padding: 0.5rem 1rem;
    cursor: pointer;
  }

  .dropdown-option:hover {
    background-color: #f3f4f6;
  }

  .dropdown-option:active {
    background-color: #d0d0d0;
  }
</style>

<div class="searchable-select-container relative">
  <div class="input-group relative">
    {#if icon}
      <button 
        class="btn btn-square btn-primary absolute left-0 top-0 rounded-r-none z-10"
        type="button"
        aria-hidden="true"
        tabindex="-1"
      >
        <Icon {icon} class="w-5 h-5" />
      </button>
    {/if}
    <input
      type="text"
      class="input input-bordered w-full {icon ? 'pl-12' : ''} focus:outline-none focus:ring-2 focus:ring-primary relative {error ? 'ring-2 ring-error' : ''}"
      {placeholder}
      bind:value={displayTerm}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeydown}
      role="combobox"
      aria-expanded={showDropdown}
      aria-controls={dropdownId}
      aria-activedescendant={activeIndex >= 0 ? `option-${options[activeIndex].key}` : undefined}
      autocomplete="off"
    />
  </div>

  {#if showDropdown}
    <ul
      id={dropdownId}
      class="dropdown-options"
      role="listbox"
    >
      {#each filteredOptions as option, i}
        <li
          id="option-{option.key}"
          class="dropdown-option {i === activeIndex ? 'bg-primary/10' : ''}"
          role="option"
          aria-selected={searchTerm === option.value}
          on:mousedown={() => selectOption(option)}
        >
          {option.display}
        </li>
      {/each}
    </ul>
  {/if}
</div>