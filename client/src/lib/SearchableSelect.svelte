<script lang="ts">
  import Icon from '@iconify/svelte';
  
  export let options: { key: number, value: string, display: string }[] = [];
  export let searchTerm: string = '';
  export let placeholder: string = '';
  export let showDropdown: boolean = false;
  export let icon: string = ''; // Optional icon name

  let displayTerm: string = '';
  let isSearching: boolean = false;

  function handleFocus() {
    showDropdown = true;
    isSearching = true;
    displayTerm = ''; // Clear for searching
  }

  function handleBlur() {
    setTimeout(() => {
      showDropdown = false;
      isSearching = false;
      // Reset display term to match selected value if it exists
      const selectedOption = options.find(opt => opt.value === searchTerm);
      displayTerm = selectedOption ? selectedOption.value : '';
    }, 100);
  }

  function selectOption(option: { key: number, value: string, display: string }) {
    searchTerm = option.value;
    displayTerm = option.value; // Show the value (name) in textbox
    isSearching = false;
    showDropdown = false;
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
    display: inline-block;
  }
  
  .searchable-select-input {
    width: 100%;
    position: relative;
  }
  
  .input-group {
    display: flex;
    align-items: center;
  }
  
  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    max-height: 400px;
    overflow-y: auto;
    width: 100%;
    z-index: 1000;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  .dropdown-option {
    padding: 10px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .dropdown-option:hover {
    background-color: #e0e0e0;
  }
  .dropdown-option:active {
    background-color: #d0d0d0;
  }
</style>

<div class="searchable-select-container">
  <div class="searchable-select-input input-group">
    {#if icon}
      <span class="flex items-center px-4">
        <Icon {icon} class="w-5 h-5 text-primary" />
      </span>
    {/if}
    <input
      type="text"
      class="input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-primary"
      placeholder={placeholder}
      bind:value={displayTerm}
      on:focus={handleFocus}
      on:blur={handleBlur}
    />
  </div>

  {#if showDropdown && filteredOptions.length > 0}
    <div class="dropdown">
      {#each filteredOptions as option}
        <div class="dropdown-option" on:click={() => selectOption(option)}>
          {option.display}
        </div>
      {/each}
    </div>
  {/if}
</div>