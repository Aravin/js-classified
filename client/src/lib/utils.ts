import { config } from "./config";
import { getAuthHeaders } from './auth/auth0';

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(
    config.currency.locale,
    config.currency.options
  ).format(amount);
}

export function getExpiryDate(createdAt: string): string {
  const createdDate = new Date(createdAt);
  const expiryDate = new Date(createdDate);
  expiryDate.setDate(createdDate.getDate() + config.listing.expiryDays);
  
  const today = new Date();
  const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) {
    return 'Expired';
  } else if (daysLeft === 0) {
    return 'Expires today';
  } else if (daysLeft === 1) {
    return 'Expires tomorrow';
  } else {
    return `Expires in ${daysLeft} days`;
  }
}

/**
 * Check if user has reached the maximum active ads limit
 * @param userId - Auth0 user ID (sub)
 * @param excludeListingId - Optional listing ID to exclude from count (for editing existing ads)
 * @returns Object with hasReachedLimit boolean and activeCount number
 */
export async function checkActiveAdsLimit(userId: string, excludeListingId?: number): Promise<{ hasReachedLimit: boolean; activeCount: number }> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${config.api.baseUrl}/listings/user/${userId}`, {
      headers: {
        'Accept': 'application/json',
        ...authHeaders
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user listings');
    }
    
    const data = await response.json();
    const listings = data.listings || [];
    
    // Count active ads, excluding the specified listing ID if provided
    const activeCount = listings.filter((listing: any) => 
      (listing.status === 'ACTIVE' || listing.status === 'active') && (excludeListingId ? listing.id !== excludeListingId : true)
    ).length;
    
    const hasReachedLimit = activeCount >= config.user.maxActiveAds;
    
    return { hasReachedLimit, activeCount };
  } catch (error) {
    console.error('Error checking active ads limit:', error);
    // On error, allow the operation (fail open)
    return { hasReachedLimit: false, activeCount: 0 };
  }
}
