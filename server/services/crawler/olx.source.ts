import { CrawledListing, CrawlerSource } from './crawler.interface';
import { FirecrawlClient } from './firecrawl.client';

export class OlxCrawlerSource implements CrawlerSource {
  name = 'OLX India';
  baseUrl = 'https://www.olx.in';
  private client: FirecrawlClient;

  constructor(client: FirecrawlClient) {
    this.client = client;
  }

  /**
   * Scrapes an OLX category page and extracts item detail page URLs.
   * Uses 1 credit for standard markdown scraping.
   */
  async getListingUrls(categoryUrl: string, limit: number): Promise<string[]> {
    console.log(`[OlxCrawlerSource] Scraping listing URLs from: ${categoryUrl}`);
    
    try {
      const result = await this.client.scrape(categoryUrl, ['markdown']);
      const markdown = result.data?.markdown || '';
      
      // OLX item URLs follow the pattern /item/<title>-iid-<id>
      const olxItemRegex = /\/item\/[a-zA-Z0-9-]*iid-\d+/g;
      const matches: string[] = markdown.match(olxItemRegex) || [];
      
      // Deduplicate and resolve relative paths
      const uniqueUrls = Array.from(new Set<string>(matches)).map((url: string) => {
        if (url.startsWith('/')) {
          return `${this.baseUrl}${url}`;
        }
        return url;
      });

      console.log(`[OlxCrawlerSource] Found ${uniqueUrls.length} unique listing links. Limiting to ${limit}.`);
      return uniqueUrls.slice(0, limit);
    } catch (error) {
      console.error('[OlxCrawlerSource] Failed to fetch listing URLs:', error);
      return [];
    }
  }

  /**
   * Scrapes an OLX listing detail page and extracts structured data using Firecrawl's LLM extraction.
   * Uses 1 credit (standard LLM-extract).
   */
  async getListingDetails(listingUrl: string, locationName: string, categorySlug: string): Promise<CrawledListing> {
    console.log(`[OlxCrawlerSource] Scraping listing details from: ${listingUrl}`);

    const listingId = this.extractListingId(listingUrl);

    try {
      const scraped = await this.client.scrape(listingUrl, ['html', 'markdown']);
      const html = scraped.data?.html || '';
      const metadataListing = this.extractListingFromHtml(html, listingUrl, listingId);

      if (metadataListing) {
        return {
          ...metadataListing,
          externalLink: listingUrl,
          locationName,
          categorySlug,
        };
      }
    } catch (error) {
      console.warn(`[OlxCrawlerSource] Metadata extraction failed for ${listingUrl}; falling back to structured extraction.`, error);
    }

    const schema = {
      type: 'object',
      properties: {
        title: { 
          type: 'string', 
          description: 'The title or name of the item being sold, e.g. "Maruti Suzuki Swift 2018 Petrol" or "iPhone 13 Pro 128GB"' 
        },
        description: { 
          type: 'string', 
          description: 'The full detailed description of the item including condition, features, usage, reason for selling, etc.' 
        },
        price: { 
          type: 'number', 
          description: 'The final price in Rupees. Convert formatting strings (like "₹ 4,50,000") to a clean number (like 450000)' 
        },
        images: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of absolute image URLs representing the photos of the product/item'
        }
      },
      required: ['title', 'description', 'price', 'images']
    };

    const extractionPrompt = 'Extract only the main OLX classified ad represented by the current page URL, not recommended ads, related ads, seller profile content, navigation, or nearby listings. Return the main ad title, main ad description, price as a number, and only the real high-resolution product photo URLs for that same main ad. Ignore placeholders, pixel trackers, loading spinners, icons, logos, and images from recommended listings. Ensure image URLs are complete and absolute.';

    try {
      const data = await this.client.scrapeAndExtract<{
        title: string;
        description: string;
        price: number;
        images: string[];
      }>(listingUrl, schema, extractionPrompt);

      if (!data.title || !data.description || typeof data.price !== 'number') {
        throw new Error('Incomplete structured data received from Firecrawl extraction.');
      }

      // Filter and clean image URLs (ensure they start with http/https)
      const cleanImages = this.cleanImageUrls(data.images || []);

      if (cleanImages.length === 0) {
        throw new Error('No valid listing images found in Firecrawl extraction.');
      }

      const title = this.cleanText(data.title);
      const description = this.cleanText(data.description);

      if (!title || !description) {
        throw new Error('Incomplete text fields received from Firecrawl extraction.');
      }

      if (this.looksLikeRecommendation(title, listingUrl)) {
        throw new Error(`Extracted title does not appear to belong to listing URL ${listingUrl}: ${title}`);
      }

      return {
        title,
        description,
        price: data.price,
        images: cleanImages,
        externalLink: listingUrl,
        locationName,
        categorySlug,
      };
    } catch (error) {
      console.error(`[OlxCrawlerSource] Failed to extract details for ${listingUrl}:`, error);
      throw error;
    }
  }

  private extractListingId(url: string): string | null {
    return url.match(/iid-(\d+)/)?.[1] || null;
  }

  private extractListingFromHtml(html: string, listingUrl: string, listingId: string | null): Omit<CrawledListing, 'externalLink' | 'locationName' | 'categorySlug'> | null {
    const jsonObjects = this.extractJsonObjects(html);
    const candidates = jsonObjects
      .flatMap(obj => this.flattenObjects(obj))
      .map(obj => this.normalizeCandidate(obj))
      .filter((candidate): candidate is Omit<CrawledListing, 'externalLink' | 'locationName' | 'categorySlug'> & { sourceUrl?: string; id?: string } => !!candidate);

    const matchingCandidate = candidates.find(candidate => {
      const source = `${candidate.sourceUrl || ''} ${candidate.id || ''}`;
      return (listingId && source.includes(listingId)) || source.includes(listingUrl);
    });

    const candidate = matchingCandidate;
    if (candidate) {
      const { sourceUrl, id, ...listing } = candidate;
      if (!this.looksLikeRecommendation(listing.title, listingUrl)) {
        return listing;
      }
    }

    const title = this.cleanText(
      this.readMeta(html, 'og:title') ||
      this.readMeta(html, 'twitter:title') ||
      this.readTag(html, 'title')
    );
    const description = this.cleanText(
      this.readMeta(html, 'og:description') ||
      this.readMeta(html, 'description') ||
      this.readMeta(html, 'twitter:description')
    );
    const image = this.readMeta(html, 'og:image') || this.readMeta(html, 'twitter:image');
    const priceText = this.readMeta(html, 'product:price:amount') || html.match(/₹\s?[\d,]+/)?.[0] || '';
    const price = this.parsePrice(priceText);
    const images = this.cleanImageUrls(image ? [image] : []);

    if (title && description && price !== null && images.length > 0 && !this.looksLikeRecommendation(title, listingUrl)) {
      return { title, description, price, images };
    }

    return null;
  }

  private extractJsonObjects(html: string): unknown[] {
    const objects: unknown[] = [];
    const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptRegex.exec(html)) !== null) {
      try {
        objects.push(JSON.parse(this.decodeHtml(match[1].trim())));
      } catch {
        // Ignore malformed embedded JSON.
      }
    }

    const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        objects.push(JSON.parse(this.decodeHtml(nextDataMatch[1].trim())));
      } catch {
        // Ignore malformed Next.js data.
      }
    }

    return objects;
  }

  private flattenObjects(value: unknown, depth = 0): Record<string, any>[] {
    if (depth > 8 || value === null || typeof value !== 'object') return [];
    if (Array.isArray(value)) {
      return value.flatMap(item => this.flattenObjects(item, depth + 1));
    }

    const objectValue = value as Record<string, any>;
    return [
      objectValue,
      ...Object.values(objectValue).flatMap(child => this.flattenObjects(child, depth + 1))
    ];
  }

  private normalizeCandidate(obj: Record<string, any>): (Omit<CrawledListing, 'externalLink' | 'locationName' | 'categorySlug'> & { sourceUrl?: string; id?: string }) | null {
    const rawTitle = obj.title || obj.name;
    const rawDescription = obj.description;
    const rawPrice = obj.price || obj.priceValue || obj.offers?.price || obj.offers?.priceSpecification?.price;
    const rawImages = obj.images || obj.image || obj.photos || obj.pictures;

    const title = this.cleanText(typeof rawTitle === 'string' ? rawTitle : '');
    const description = this.cleanText(typeof rawDescription === 'string' ? rawDescription : '');
    const price = this.parsePrice(rawPrice);
    const images = this.cleanImageUrls(this.toStringArray(rawImages));

    if (!title || !description || price === null || images.length === 0) {
      return null;
    }

    return {
      title,
      description,
      price,
      images,
      sourceUrl: obj.url || obj.canonicalUrl || obj.shareUrl || obj.href,
      id: String(obj.id || obj.itemId || obj.adId || obj.listingId || ''),
    };
  }

  private toStringArray(value: unknown): string[] {
    if (!value) return [];
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) {
      return value.flatMap(item => {
        if (typeof item === 'string') return [item];
        if (item && typeof item === 'object') {
          const objectItem = item as Record<string, unknown>;
          return this.toStringArray(objectItem.url || objectItem.src || objectItem.href);
        }
        return [];
      });
    }
    if (typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      return this.toStringArray(objectValue.url || objectValue.src || objectValue.href);
    }
    return [];
  }

  private cleanImageUrls(images: string[]): string[] {
    return Array.from(new Set(images
        .map(img => img.trim())
        .filter(img => img.startsWith('http://') || img.startsWith('https://'))
        .filter(img => !/placeholder|spinner|loader|pixel|tracking|logo|icon/i.test(img))));
  }

  private readMeta(html: string, name: string): string {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i');
    const match = html.match(regex);
    return this.decodeHtml(match?.[1] || match?.[2] || '');
  }

  private readTag(html: string, tag: string): string {
    const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return this.decodeHtml(match?.[1] || '');
  }

  private cleanText(value: string): string {
    return this.decodeHtml(value)
      .replace(/\s*\|\s*OLX.*$/i, '')
      .replace(/\s*-\s*OLX.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parsePrice(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const parsed = Number(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private decodeHtml(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private looksLikeRecommendation(title: string, listingUrl: string): boolean {
    const ignoredTokens = new Set([
      'item', 'iid', 'used', 'in', 'mobile', 'phones', 'phone', 'car', 'cars', 'chennai',
      'hyderabad', 'bengaluru', 'bangalore', 'mumbai', 'delhi', 'olx', 'india', 'c1453', 'c84'
    ]);

    const tokenize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 2 && !ignoredTokens.has(token) && /[a-z]/.test(token));

    const titleTokens = tokenize(title);
    const urlTokens = tokenize(listingUrl);
    const normalizedUrl = listingUrl.toLowerCase().replace(/[^a-z0-9]+/g, '');

    if (titleTokens.length < 2 || urlTokens.length === 0) {
      return false;
    }

    const overlap = titleTokens.filter((token) => urlTokens.includes(token));
    if (overlap.length > 0) {
      return false;
    }

    if (titleTokens.some((token) => token.length >= 5 && normalizedUrl.includes(token))) {
      return false;
    }

    for (let i = 0; i < titleTokens.length - 1; i++) {
      const combinedToken = `${titleTokens[i]}${titleTokens[i + 1]}`;
      if (combinedToken.length >= 6 && normalizedUrl.includes(combinedToken)) {
        return false;
      }
    }

    return true;
  }
}
