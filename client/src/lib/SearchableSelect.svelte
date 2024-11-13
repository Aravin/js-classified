<script lang="ts">
  export let options: { key: string, value: string }[] = [];
  export let searchTerm: string = '';
  export let placeholder: string = '';
  export let showDropdown: boolean = false;

  function handleFocus() {
    showDropdown = true;
  }

  function handleBlur() {
    // Delay the hiding of the dropdown to allow option selection
    setTimeout(() => {
      showDropdown = false;
    }, 100);
  }

  function selectOption(option: { key: string, value: string }) {
    searchTerm = option.value;
    showDropdown = false;
    // You can add additional logic here to handle the selected option
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

  {#if showDropdown && options.filter(option => option.value.toLowerCase().includes(searchTerm.toLowerCase())).length > 0}
    <div class="dropdown">
      {#each options.filter(option => option.value.toLowerCase().includes(searchTerm.toLowerCase())) as option}
        <div class="dropdown-option" on:click={() => selectOption(option)}>
          {option.value}
        </div>
      {/each}
    </div>
  {/if}
</div>