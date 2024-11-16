import type { PageLoad } from './$types';
import { config } from '$lib/config';
import { error } from '@sveltejs/kit';

export const load: PageLoad = (async ({ params }) => {
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
    console.error('Error loading listing:', err);
    throw error(500, 'Failed to load listing');
  }
});