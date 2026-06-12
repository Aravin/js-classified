import { config } from '$lib/config';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { RequestHandler } from './$types';

let fontData: ArrayBuffer | null = null;

// Helper to fetch Inter font for satori rendering
async function getFontData() {
	if (fontData) return fontData;
	try {
		const response = await fetch(
			'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp5SRy2GgK9nMc5nbQ.ttf'
		);
		if (!response.ok) {
			throw new Error('Failed to fetch font');
		}
		fontData = await response.arrayBuffer();
		return fontData;
	} catch (error) {
		console.error('Error fetching font:', error);
		// Fallback font fetch if first one fails
		const fallback = await fetch(
			'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf'
		);
		fontData = await fallback.arrayBuffer();
		return fontData;
	}
}

// Generate fallback/generic OG image when listing is not found or error occurs
async function generateFallbackImage(title: string, subtitle: string) {
	const font = await getFontData();
	const svg = await satori(
		{
			type: 'div',
			props: {
				style: {
					display: 'flex',
					flexDirection: 'column',
					width: '1200px',
					height: '630px',
					backgroundColor: '#4f46e5',
					backgroundImage: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
					padding: '80px',
					boxSizing: 'border-box',
					fontFamily: 'Inter',
					justifyContent: 'space-between',
					color: '#ffffff'
				},
				children: [
					{
						type: 'div',
						props: {
							style: {
								fontSize: '48px',
								fontWeight: 'bold',
								letterSpacing: '1px'
							},
							children: 'locful.com'
						}
					},
					{
						type: 'div',
						props: {
							style: {
								display: 'flex',
								flexDirection: 'column',
								gap: '24px'
							},
							children: [
								{
									type: 'div',
									props: {
										style: {
											fontSize: '64px',
											fontWeight: 'bold',
											lineHeight: '1.2'
										},
										children: title
									}
								},
								{
									type: 'div',
									props: {
										style: {
											fontSize: '32px',
											color: '#c7d2fe',
											lineHeight: '1.4'
										},
										children: subtitle
									}
								}
							]
						}
					},
					{
						type: 'div',
						props: {
							style: {
								fontSize: '24px',
								color: '#a5b4fc',
								borderTop: '1px solid rgba(255, 255, 255, 0.2)',
								paddingTop: '24px'
							},
							children: 'India\'s Hyper-Local Classifieds Platform'
						}
					}
				]
			}
		},
		{
			width: 1200,
			height: 630,
			fonts: [
				{
					name: 'Inter',
					data: font,
					weight: 400,
					style: 'normal'
				}
			]
		}
	);

	const resvg = new Resvg(svg, {
		fitTo: {
			mode: 'width',
			value: 1200
		}
	});

	return resvg.render().asPng();
}

export const GET: RequestHandler = async ({ params, fetch }) => {
	try {
		const id = params.slug;
		const response = await fetch(`${config.api.baseUrl}/listings/${id}`);
		
		if (!response.ok) {
			const fallbackPng = await generateFallbackImage(
				'Locful Classifieds',
				'Buy, sell, rent or find local jobs in India.'
			);
			return new Response(fallbackPng, {
				headers: {
					'Content-Type': 'image/png',
					'Cache-Control': 'public, max-age=3600'
				}
			});
		}

		const listing = await response.json();
		const font = await getFontData();

		// Formatting clean price string (INR format)
		const formattedPrice = listing.price 
			? `₹${Number(listing.price).toLocaleString('en-IN')}`
			: 'Free';

		// Truncating description for visually clean presentation
		const truncatedDescription = listing.description.length > 180
			? listing.description.substring(0, 180) + '...'
			: listing.description;

		const svg = await satori(
			{
				type: 'div',
				props: {
					style: {
						display: 'flex',
						flexDirection: 'column',
						width: '1200px',
						height: '630px',
						backgroundColor: '#ffffff',
						backgroundImage: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
						padding: '60px',
						boxSizing: 'border-box',
						fontFamily: 'Inter',
						justifyContent: 'space-between'
					},
					children: [
						// Header Section
						{
							type: 'div',
							props: {
								style: {
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center'
								},
								children: [
									{
										type: 'div',
										props: {
											style: {
												fontSize: '42px',
												fontWeight: 'bold',
												color: '#4f46e5'
											},
											children: 'locful.com'
										}
									},
									{
										type: 'div',
										props: {
											style: {
												fontSize: '22px',
												color: '#4b5563',
												backgroundColor: '#e5e7eb',
												padding: '8px 20px',
												borderRadius: '24px'
											},
											children: listing.category?.name || 'Classified'
										}
									}
								]
							}
						},
						// Content Section
						{
							type: 'div',
							props: {
								style: {
									display: 'flex',
									flexDirection: 'column',
									gap: '20px',
									flex: 1,
									justifyContent: 'center'
								},
								children: [
									{
										type: 'div',
										props: {
											style: {
												fontSize: '58px',
												fontWeight: 'bold',
												color: '#111827',
												lineHeight: '1.25',
												maxHeight: '150px',
												overflow: 'hidden'
											},
											children: listing.title
										}
									},
									{
										type: 'div',
										props: {
											style: {
												fontSize: '26px',
												color: '#4b5563',
												lineHeight: '1.5',
												maxHeight: '120px',
												overflow: 'hidden'
											},
											children: truncatedDescription
										}
									}
								]
							}
						},
						// Footer Section
						{
							type: 'div',
							props: {
								style: {
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									borderTop: '2px solid #e5e7eb',
									paddingTop: '30px'
								},
								children: [
									{
										type: 'div',
										props: {
											style: {
												display: 'flex',
												flexDirection: 'column'
											},
											children: [
												{
													type: 'div',
													props: {
														style: {
															fontSize: '18px',
															color: '#9ca3af',
															textTransform: 'uppercase',
															letterSpacing: '1.5px',
															marginBottom: '4px'
														},
														children: 'Location'
													}
												},
												{
													type: 'div',
													props: {
														style: {
															fontSize: '32px',
															fontWeight: 'bold',
															color: '#374151'
														},
														children: listing.location?.name || 'India'
													}
												}
											]
										}
									},
									{
										type: 'div',
										props: {
											style: {
												fontSize: '48px',
												fontWeight: 'bold',
												color: '#4f46e5',
												backgroundColor: '#e0e7ff',
												padding: '14px 36px',
												borderRadius: '18px'
											},
											children: formattedPrice
										}
									}
								]
							}
						}
					]
				}
			},
			{
				width: 1200,
				height: 630,
				fonts: [
					{
						name: 'Inter',
						data: font,
						weight: 400,
						style: 'normal'
					}
				]
			}
		);

		const resvg = new Resvg(svg, {
			fitTo: {
				mode: 'width',
				value: 1200
			}
		});
		const pngBuffer = resvg.render().asPng();

		return new Response(pngBuffer, {
			headers: {
				'Content-Type': 'image/png',
				'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
			}
		});
	} catch (error) {
		console.error('Error generating listing OG image:', error);
		try {
			const fallbackPng = await generateFallbackImage(
				'Locful Classifieds',
				'Local Classifieds Platform in India'
			);
			return new Response(fallbackPng, {
				headers: {
					'Content-Type': 'image/png',
					'Cache-Control': 'public, max-age=3600'
				}
			});
		} catch (fallbackError) {
			return new Response('Error generating image', { status: 500 });
		}
	}
};
