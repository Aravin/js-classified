import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url, fetch }) => {
  const id = url.searchParams.get('id');
  
  if (!id) {
    throw new Error('Listing ID is required');
  }

  // Then fetch the full listing data using the ID
  const listingResponse = await fetch(`http://localhost:8080/api/listings/${id}`);
  
  if (!listingResponse.ok) {
    throw new Error('Failed to load listing details');
  }

  const listing = await listingResponse.json();
  return { listing };
};