import { config } from '$lib/config';
import type { PageLoad } from './$types';
import { categories } from '$lib/categories/categories';
import type { ListingType } from '$lib/types';

interface ApiResponse<T> {
    listings: ListingType[];
    total: number;
    page: number;
    totalPages: number;
}

export const load = (async ({ url, params, fetch }) => {
    const searchParams = new URLSearchParams();
    
    // Get category from slug param
    const category = categories.find(cat => cat.slug === params.slug);
    
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
    searchParams.set('categoryId', category.key.toString());
    if (location) searchParams.set('locationId', location);
    if (hasImages) searchParams.set('hasImages', 'true');
    searchParams.set('page', page.toString());
    searchParams.set('limit', limit.toString());
    searchParams.set('sortBy', sortBy);
    searchParams.set('order', order);

    try {
        // First try: exact match (category + location if provided)
        let response = await fetch(
            `${config.api.baseUrl}/listings?${searchParams.toString()}`
        );

        if (!response.ok) {
            throw new Error('Failed to fetch listings');
        }

        let result: ApiResponse<ListingType> = await response.json();
        let fallbackType: 'none' | 'location' | 'category' = 'none';

        // If no results and location is specified, try fallback strategies
        if ((result.listings || []).length === 0 && location) {
            // Fallback 1: Same location, any category
            const fallbackParams1 = new URLSearchParams();
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
                fallbackParams2.set('categoryId', category.key.toString());
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
        } else if ((result.listings || []).length === 0 && !location) {
            // If no location is specified and no results, try removing hasImages filter as fallback
            // This only applies if hasImages filter was active
            if (hasImages) {
                const fallbackParams = new URLSearchParams();
                fallbackParams.set('categoryId', category.key.toString());
                // Note: hasImages filter removed to broaden search
                fallbackParams.set('page', page.toString());
                fallbackParams.set('limit', limit.toString());
                fallbackParams.set('sortBy', sortBy);
                fallbackParams.set('order', order);

                const fallbackResponse = await fetch(
                    `${config.api.baseUrl}/listings?${fallbackParams.toString()}`
                );

                if (fallbackResponse.ok) {
                    const fallbackResult = await fallbackResponse.json();
                    if ((fallbackResult.listings || []).length > 0) {
                        result = fallbackResult;
                        // Don't set fallbackType here since we're not changing location or category,
                        // just relaxing the hasImages filter. The UI won't show a fallback message in this case.
                    }
                }
            }
            // If hasImages was already false and no results, there's no meaningful fallback
            // since we're already searching all locations for this category
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
            category,
            location,
            sortBy,
            order,
            hasImages,
            slug: params.slug,
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
            category,
            location,
            sortBy,
            order,
            hasImages,
            slug: params.slug,
            fallbackType: 'none' as const
        };
    }
}) satisfies PageLoad;