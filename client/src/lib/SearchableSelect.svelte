<script lang="ts">
  export let options: string[] = [];
  export let placeholder: string = 'Search...';
  let searchTerm: string = '';
  let showDropdown: boolean = false;

  function handleFocus() {
    showDropdown = true;
  }

  function handleBlur() {
    // Delay hiding the dropdown to allow click events to register
    setTimeout(() => showDropdown = false, 200);
  }

  function selectOption(option: string) {
    searchTerm = option;
    showDropdown = false;
  }
</script>

<style>
  .dropdown {
    position: absolute;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    max-height: 150px;
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

<div class="relative">
  <input
    type="text"
    class="input input-bordered"
    bind:value={searchTerm}
    placeholder={placeholder}
    on:focus={handleFocus}
    on:blur={handleBlur}
  />

  {#if showDropdown && options.filter(option => option.toLowerCase().includes(searchTerm.toLowerCase())).length > 0}
    <div class="dropdown">
      {#each options.filter(option => option.toLowerCase().includes(searchTerm.toLowerCase())) as option}
        <div class="dropdown-option" on:click={() => selectOption(option)}>
          {option}
        </div>
      {/each}
    </div>
  {/if}
</div>