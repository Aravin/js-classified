export interface LocationType {
    key: number;
    value: string;
    name: string;
    state: string;
}

export interface CategoryType {
    key: number;
    value: string;
    slug: string;
}

export interface ImageType {
    id: number;
    path: string;
    listing_id: number;
}

export interface ListingType {
    id: number;
    title: string;
    description: string;
    price: number;
    location: LocationType;
    category: CategoryType;
    images: ImageType[];
    slug: string;
    createdAt: string;
    updatedAt: string;
}

export interface PaginationType {
    total: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasMore: boolean;
}

export interface ApiResponse<T> {
    listings: T[];
    pagination: PaginationType;
}

export interface ImageUploadResult {
  id: number;
  path: string;
  thumbnailPath: string | null;
  order: number;
  listingId: number;
  createdAt: string;
}