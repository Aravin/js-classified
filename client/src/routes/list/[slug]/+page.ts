import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const response = await fetch(`http://localhost:8080/api/listings/${params.slug}`);
  
  if (!response.ok) {
    throw new Error('Listing not found');
  }

  const listing = await response.json();
  return { listing };
};