import { config } from '$lib/config';
import type { PageLoad } from './$types';
import type { ListingType } from '$lib/types';

interface ApiResponse<T> {
    listings: ListingType[];
    total: number;
    page: number;
    totalPages: number;
}

export const load: PageLoad = async ({ url }) => {
    const searchParams = new URLSearchParams();
    
    // Get search parameters
    const q = url.searchParams.get('q');
    const location = url.searchParams.get('location');
    const category = url.searchParams.get('category');
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = config.pagination.defaultLimit;
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const order = url.searchParams.get('order') || 'desc';
    const hasImages = url.searchParams.get('hasImages') === 'true';

    // Build API query
    if (q) searchParams.set('search', q);
    if (location) searchParams.set('locationId', location);
    if (category) searchParams.set('categoryId', category);
    if (hasImages) searchParams.set('hasImages', 'true');
    searchParams.set('page', page.toString());
    searchParams.set('limit', limit.toString());
    searchParams.set('sortBy', sortBy);
    searchParams.set('order', order);

    try {
        const response = await fetch(
            `${config.api.baseUrl}/listings?${searchParams.toString()}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch listings');
        }

        const result: ApiResponse<ListingType> = await response.json();

        return {
            listings: result.listings || [],
            pagination: {
                total: result.total,
                totalPages: result.totalPages,
                currentPage: result.page,
                limit: config.pagination.defaultLimit,
                hasMore: result.page < result.totalPages
            },
            q,
            location,
            category,
            sortBy,
            order,
            hasImages
        };
    } catch (error) {
        console.error('Error fetching listings:', error);
        return {
            listings: [],
            pagination: {
                total: 0,
                totalPages: 1,
                currentPage: 1,
                limit: config.pagination.defaultLimit,
                hasMore: false
            },
            q,
            location,
            category,
            sortBy,
            order,
            hasImages
        };
    }
};