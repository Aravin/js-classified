<script lang="ts">
  import '../app.css';
  import Icon from '@iconify/svelte';
  import { categoryList } from '$lib/categories/index';
  import { locations } from '$lib/locations';
  import SearchableSelect from '$lib/SearchableSelect.svelte';
</script>

<header class="bg-rose-800 p-4">
  <div class="container mx-auto flex flex-col items-center justify-between md:flex-row">
    <h1 class="mb-2 text-2xl font-bold text-gray-300 md:mb-0">JS Classifieds</h1>
    <div class="flex flex-col items-center space-y-2 md:flex-row md:space-x-4 md:space-y-0">
      <div class="form-control w-full md:w-60">
        <SearchableSelect
          options={locations.map((location) => ({
            key: location.id.toString(),
            value: location.loc
          }))}
          placeholder="Search location..."
        />
      </div>

      <div class="form-control w-full md:w-60">
        <SearchableSelect options={categoryList} placeholder="Search category..." />
      </div>

      <div class="form-control w-full md:w-auto">
        <div class="input-group relative">
          <input type="text" placeholder="Search..." class="input input-bordered w-full" />
          <button class="btn btn-square absolute right-0 top-0 rounded-l-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              /></svg
            >
          </button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:space-x-2">
        <button class="btn btn-primary mb-2 sm:mb-0">Login</button>
        <button class="btn btn-accent">Post Ad</button>
      </div>
    </div>
  </div>
</header>

<main class="container mx-auto min-h-[66vh] p-4">
  <slot />
</main>

<footer class="bg-gray-800 p-6 text-white">
  <div class="container mx-auto grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
    <div>
      <h3 class="mb-4 text-lg font-bold">Trending Searches</h3>
      <div class="flex flex-wrap gap-2">
        <a href="#" class="badge badge-outline">Electronics</a>
        <a href="#" class="badge badge-outline">Cars</a>
        <a href="#" class="badge badge-outline">Real Estate</a>
        <a href="#" class="badge badge-outline">Jobs</a>
        <a href="#" class="badge badge-outline">Services</a>
      </div>
    </div>
    <div>
      <h3 class="mb-4 text-lg font-bold">Popular Categories</h3>
      <ul class="space-y-2">
        <li><a href="#">Mobiles</a></li>
        <li><a href="#">Vehicles</a></li>
        <li><a href="#">Property for Sale</a></li>
        <li><a href="#">Fashion & Beauty</a></li>
        <li><a href="#">Home & Garden</a></li>
      </ul>
    </div>
    <div>
      <h3 class="mb-4 text-lg font-bold">Company</h3>
      <ul class="space-y-2">
        <li><a href="#">About Us</a></li>
        <li><a href="#">Contact Us</a></li>
        <li><a href="#">Terms & Conditions</a></li>
        <li><a href="#">Privacy Policy</a></li>
      </ul>
    </div>
    <div>
      <h3 class="mb-4 text-lg font-bold">Follow Us</h3>
      <div class="flex space-x-4">
        <a href="#"><Icon icon="line-md:facebook" font-size="32" /></a>
        <a href="#"><Icon icon="line-md:instagram" font-size="32" /></a>
        <a href="#"><Icon icon="line-md:twitter-x" font-size="32" /></a>
        <a href="#"><Icon icon="line-md:youtube" font-size="32" /></a>
      </div>
    </div>
  </div>
  <div class="mt-8 text-center text-gray-500">
    &copy; {new Date().getFullYear()} JS Classifieds. All rights reserved.
  </div>
</footer>
