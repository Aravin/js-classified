export interface CrawledListing {
  title: string;
  description: string;
  price: number;
  images: string[];
  externalLink: string;
  locationName: string;
  categorySlug: string;
}

export interface CrawlerSource {
  name: string;
  baseUrl: string;
  
  /**
   * Scrapes a category page to find listing URLs.
   * 
   * @param categoryUrl The category page URL.
   * @param limit Max URLs to extract.
   * @returns A promise resolving to an array of absolute URLs.
   */
  getListingUrls(categoryUrl: string, limit: number): Promise<string[]>;
  
  /**
   * Scrapes and extracts full details of a specific listing.
   * 
   * @param listingUrl The URL of the listing page.
   * @param locationName The corresponding locful location name.
   * @param categorySlug The corresponding locful category slug.
   * @returns A promise resolving to the structured CrawledListing object.
   */
  getListingDetails(listingUrl: string, locationName: string, categorySlug: string): Promise<CrawledListing>;
}
