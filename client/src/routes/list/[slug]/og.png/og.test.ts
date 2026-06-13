import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './+server';

// Mock satori
vi.mock('satori', () => {
	return {
		default: () => Promise.resolve('<svg>mock-svg</svg>')
	};
});

// Mock @resvg/resvg-js using a constructor-compatible ES6 class
vi.mock('@resvg/resvg-js', () => {
	class MockResvg {
		render() {
			return {
				asPng: () => new TextEncoder().encode('mock-png-buffer')
			};
		}
	}
	return {
		Resvg: MockResvg
	};
});

describe('OG Image Endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		// Mock global fetch for font fetching
		globalThis.fetch = vi.fn().mockImplementation((url) => {
			if (url.includes('.ttf')) {
				return Promise.resolve({
					ok: true,
					arrayBuffer: async () => new ArrayBuffer(8)
				} as any);
			}
			return Promise.resolve({
				ok: false
			} as any);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return a generated PNG image for a valid listing', async () => {
		const mockListing = {
			id: 123,
			title: 'Beautiful Sofa',
			description: 'Like new sofa for sale in good condition',
			price: '15000',
			slug: 'beautiful-sofa-123',
			location: { name: 'Indiranagar, Bangalore' },
			category: { name: 'Furniture' }
		};

		// Mock the fetch call to Fastify API
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockListing
		} as Response);

		const requestEvent = {
			fetch: mockFetch,
			params: { slug: 'beautiful-sofa-123' },
			url: new URL('https://locful.com/list/beautiful-sofa-123/og.png')
		} as any;

		const response = await GET(requestEvent);
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/png');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');

		const arrayBuffer = await response.arrayBuffer();
		const text = new TextDecoder().decode(new Uint8Array(arrayBuffer));
		expect(text).toBe('mock-png-buffer');
	});

	it('should return a fallback PNG image if the listing does not exist (404)', async () => {
		// Mock API 404 response
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 404
		} as Response);

		const requestEvent = {
			fetch: mockFetch,
			params: { slug: 'non-existent-slug' },
			url: new URL('https://locful.com/list/non-existent-slug/og.png')
		} as any;

		const response = await GET(requestEvent);
		expect(response.status).toBe(200); // Serve fallback image with 200
		expect(response.headers.get('Content-Type')).toBe('image/png');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');

		const arrayBuffer = await response.arrayBuffer();
		const text = new TextDecoder().decode(new Uint8Array(arrayBuffer));
		expect(text).toBe('mock-png-buffer');
	});

	it('should return a fallback PNG image if the API call throws an error', async () => {
		// Mock API failure
		const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

		const requestEvent = {
			fetch: mockFetch,
			params: { slug: 'error-slug' },
			url: new URL('https://locful.com/list/error-slug/og.png')
		} as any;

		const response = await GET(requestEvent);
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/png');

		const arrayBuffer = await response.arrayBuffer();
		const text = new TextDecoder().decode(new Uint8Array(arrayBuffer));
		expect(text).toBe('mock-png-buffer');
	});
});
