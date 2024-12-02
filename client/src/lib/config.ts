import { env } from '$env/dynamic/public';

// Get environment variables with fallbacks
const currencyCode = env.PUBLIC_CURRENCY_CODE ?? 'INR';
const locale = env.PUBLIC_LOCALE ?? 'en-IN';
const apiUrl = env.PUBLIC_API_URL ?? 'http://localhost:8080/api';
const expiryDays = Number(env.PUBLIC_LISTING_EXPIRY_DAYS) || 30;

export const config = {
    listing: {
        expiryDays
    },
    api: {
        baseUrl: apiUrl
    },
    currency: {
        code: currencyCode,
        locale,
        options: {
            style: 'currency',
            currency: currencyCode,
            maximumFractionDigits: 0
        }
    },
    pagination: {
        defaultLimit: Number(env.PUBLIC_SEARCH_DEFAULT_LIMIT) || 5,
    },
    auth0: {
        domain: env.PUBLIC_AUTH0_DOMAIN + '',
        clientId: env.PUBLIC_AUTH0_CLIENT_ID + '',
        callbackUrl: env.PUBLIC_AUTH0_CALLBACK_URL
    }
} as const;