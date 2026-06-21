import { config } from '../../config/config';

export class FirecrawlClient {
  private apiKey: string;
  private baseUrl = 'https://api.firecrawl.dev/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.firecrawl.apiKey;
  }

  /**
   * Scrapes a page using Firecrawl.
   * 
   * @param url The page URL to scrape.
   * @param formats The desired formats (e.g. ['markdown', 'html']).
   * @returns The raw response from Firecrawl.
   */
  async scrape(url: string, formats: string[] = ['markdown']): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Firecrawl API key is not configured. Please set FIRECRAWL_API_KEY environment variable.');
    }

    const response = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl scrape request failed (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Scrapes a page and extracts structured data using a JSON schema.
   * 
   * @param url The page URL to scrape.
   * @param schema The JSON Schema definition for LLM structured extraction.
   * @param prompt Optional system prompt to guide extraction.
   * @returns The extracted JSON data structure.
   */
  async scrapeAndExtract<T>(url: string, schema: any, prompt?: string): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Firecrawl API key is not configured. Please set FIRECRAWL_API_KEY environment variable.');
    }

    const response = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['json'],
        jsonOptions: {
          schema,
          ...(prompt && { prompt }),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl structured extraction failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    if (result.success && result.data && result.data.json) {
      return result.data.json as T;
    }

    throw new Error(`Firecrawl did not return structured JSON: ${JSON.stringify(result)}`);
  }

  /**
   * Fetches the current credit usage and billing period info from Firecrawl.
   * Uses Firecrawl v2 API endpoint.
   */
  async getCreditUsage(): Promise<{ remainingCredits: number; billingPeriodEnd: string } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl.replace('/v1', '/v2')}/team/credit-usage`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        console.warn(`[FirecrawlClient] Failed to fetch credit usage (${response.status})`);
        return null;
      }

      const result = await response.json();
      if (result.success && result.data) {
        return {
          remainingCredits: result.data.remainingCredits,
          billingPeriodEnd: result.data.billingPeriodEnd,
        };
      }
      return null;
    } catch (error) {
      console.error('[FirecrawlClient] Error fetching credit usage:', error);
      return null;
    }
  }
}
