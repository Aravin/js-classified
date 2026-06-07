import type { PageLoad } from './$types';
import { config } from '$lib/config';
import { error } from '@sveltejs/kit';

export const load: PageLoad = (async ({ params, fetch }) => {
  try {
    const id = params.slug;
    const response = await fetch(`${config.api.baseUrl}/listings/${id}`);
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
    // Re-throw SvelteKit HttpErrors (e.g. 404) as-is so the error page
    // shows the correct status instead of always falling back to 500.
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error loading listing:', err);
    throw error(500, 'Failed to load listing');
  }
});