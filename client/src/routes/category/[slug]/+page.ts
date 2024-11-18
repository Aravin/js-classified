import { config } from '$lib/config';
import type { PageLoad } from './$types';
import { categories } from '$lib/categories/categories';
import type { ListingType } from '$lib/types';

interface ApiResponse<T> {
    listings: ListingType[];
    pagination: {
        total: number;
        totalPages: number;
        currentPage: number;
        limit: number;
        hasMore: boolean;
    };
}

export const load = (async ({ url, params, fetch }) => {
    const searchParams = new URLSearchParams();
    
    // Get category from URL params
    const categoryId = url.searchParams.get('category');
    const category = categories.find(cat => cat.key.toString() === categoryId);
    
    if (!category) {
        throw new Error('Category not found');
    }

    // Get other search parameters
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = config.pagination.defaultLimit;
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const order = url.searchParams.get('order') || 'desc';
    const hasImages = url.searchParams.get('hasImages') === 'true';
    const location = url.searchParams.get('location');

    // Build API query
    searchParams.set('categoryId', categoryId + '');
    if (location) searchParams.set('locationId', location);
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
            pagination: result.pagination || {
                total: 0,
                totalPages: 1,
                currentPage: 1,
                limit: config.pagination.defaultLimit,
                hasMore: false
            },
            category,
            location,
            sortBy,
            order,
            hasImages,
            slug: params.slug
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
            category,
            location,
            sortBy,
            order,
            hasImages,
            slug: params.slug
        };
    }
}) satisfies PageLoad;