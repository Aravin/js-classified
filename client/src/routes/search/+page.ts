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
        // First try: exact match (with all filters)
        let response = await fetch(
            `${config.api.baseUrl}/listings?${searchParams.toString()}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch listings');
        }

        let result: ApiResponse<ListingType> = await response.json();
        let fallbackType: 'none' | 'location' | 'category' = 'none';

        // If no results and both category and location are specified, try fallback strategies
        if ((result.listings || []).length === 0 && location && category) {
            // Fallback 1: Same location, any category (remove category filter)
            const fallbackParams1 = new URLSearchParams();
            if (q) fallbackParams1.set('search', q);
            fallbackParams1.set('locationId', location);
            if (hasImages) fallbackParams1.set('hasImages', 'true');
            fallbackParams1.set('page', page.toString());
            fallbackParams1.set('limit', limit.toString());
            fallbackParams1.set('sortBy', sortBy);
            fallbackParams1.set('order', order);

            const fallbackResponse1 = await fetch(
                `${config.api.baseUrl}/listings?${fallbackParams1.toString()}`
            );

            if (fallbackResponse1.ok) {
                const fallbackResult1 = await fallbackResponse1.json();
                if ((fallbackResult1.listings || []).length > 0) {
                    result = fallbackResult1;
                    fallbackType = 'category';
                }
            }

            // Fallback 2: Same category, any location (if fallback 1 had no results)
            if (fallbackType === 'none') {
                const fallbackParams2 = new URLSearchParams();
                if (q) fallbackParams2.set('search', q);
                fallbackParams2.set('categoryId', category);
                if (hasImages) fallbackParams2.set('hasImages', 'true');
                fallbackParams2.set('page', page.toString());
                fallbackParams2.set('limit', limit.toString());
                fallbackParams2.set('sortBy', sortBy);
                fallbackParams2.set('order', order);

                const fallbackResponse2 = await fetch(
                    `${config.api.baseUrl}/listings?${fallbackParams2.toString()}`
                );

                if (fallbackResponse2.ok) {
                    const fallbackResult2 = await fallbackResponse2.json();
                    if ((fallbackResult2.listings || []).length > 0) {
                        result = fallbackResult2;
                        fallbackType = 'location';
                    }
                }
            }
        }

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
            hasImages,
            fallbackType
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
            hasImages,
            fallbackType: 'none' as const
        };
    }
};