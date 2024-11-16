import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ url, params }) => {
  const id = url.searchParams.get('id');
  
  if (!id) {
    throw error(400, 'Missing listing ID');
  }

  try {
    const response = await fetch(`http://localhost:8080/api/listings/${id}`);
    if (!response.ok) {
      throw error(response.status, 'Failed to fetch listing');
    }
    
    const listing = await response.json();
    
    return {
      listing: {
        ...listing,
        hasPhone: listing.hasPhone || false,
        hasEmail: listing.hasEmail || false
      }
    };
  } catch (err) {
    console.error('Error loading listing:', err);
    throw error(500, 'Failed to load listing');
  }
};