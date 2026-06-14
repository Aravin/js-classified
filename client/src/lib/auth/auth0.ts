import { Auth0Client, User } from '@auth0/auth0-spa-js';
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { config } from '$lib/config';
import { goto } from '$app/navigation';
import { refreshRewardSummary } from '$lib/rewards';

// Create stores
export const isAuthenticated = writable(false);
export const user = writable<User | null>(null);
export const auth0Client = writable<Auth0Client | null>(null);
export const popupOpen = writable(false);
export const error = writable<string | null>(null);
export const isInitializing = writable(true);
export const isLoading = writable(true);

let _auth0Client: Auth0Client;

async function syncUserToApi(userData: User) {
  try {
    const apiUrl = `${config.api.baseUrl}/users`;
    const authHeaders = await getAuthHeaders();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        userId: userData.sub,
        email: userData.email,
        fullName: userData.name,
        avatar: userData.picture,
      }),
    });

    if (!response.ok) {
      console.error('Failed to sync user data:', await response.text());
      return;
    }

    await refreshRewardSummary(fetch, authHeaders);
  } catch (e) {
    console.error('Error syncing user data:', e);
  }
}

export async function initAuth0() {
  // Only run in browser - don't initialize during SSR
  if (!browser) {
    isInitializing.set(false);
    isLoading.set(false);
    return null;
  }

  // Only initialize once
  if (_auth0Client) {
    isInitializing.set(false);
    isLoading.set(false);
    return _auth0Client;
  }

  try {
    const Auth0ClientModule = await import('@auth0/auth0-spa-js');
    _auth0Client = await Auth0ClientModule.createAuth0Client({
      domain: config.auth0.domain,
      clientId: config.auth0.clientId,
      authorizationParams: {
        redirect_uri: config.auth0.callbackUrl,
      },
      cacheLocation: 'localstorage',
      useRefreshTokens: true, // Enable automatic token refresh
      useRefreshTokensFallback: true, // Fallback to refresh tokens
    });

    auth0Client.set(_auth0Client);

    // Check authentication state
    try {
      const isAuth = await _auth0Client.isAuthenticated();
      isAuthenticated.set(isAuth);

      if (isAuth) {
        const userProfile = await _auth0Client.getUser();
        user.set(userProfile || null);

        if (userProfile) {
          await syncUserToApi(userProfile);
        }
      }
    } catch (err) {
      console.error('Error checking authentication', err);
    }
  } catch (err) {
    error.set(err instanceof Error ? err.message : 'Failed to initialize auth0');
  } finally {
    isInitializing.set(false);
    isLoading.set(false);
  }

  return _auth0Client;
}

// Cached auth state for quick access
export const authState = derived(
  [isAuthenticated, user, isInitializing, isLoading],
  ([$isAuthenticated, $user, $isInitializing, $isLoading]) => ({
    isAuthenticated: $isAuthenticated,
    user: $user,
    isInitializing: $isInitializing,
    isLoading: $isLoading,
  }),
);

// Initialize the Auth0 client (only in browser)
if (browser) {
  initAuth0();
}

/**
 * Get the ID token for API authentication
 * Returns ID token (JWT) if user is authenticated, null otherwise
 * Automatically refreshes token if expired via Auth0 SDK
 */
export async function getIdToken(): Promise<string | null> {
  try {
    const client = get(auth0Client);
    if (!client) return null;

    const isAuth = await client.isAuthenticated();
    if (!isAuth) return null;

    try {
      // getIdTokenClaims automatically refreshes the token if expired
      // The Auth0 SDK handles token refresh internally
      const claims = await client.getIdTokenClaims();
      return claims?.__raw || null;
    } catch (err: any) {
      return null;
    }
  } catch (err) {
    return null;
  }
}

/**
 * Get authorization headers for API requests
 * Uses ID token for authentication
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }
  return {};
}

// Login function
export async function login() {
  try {
    popupOpen.set(true);
    const client = get(auth0Client);
    if (!client) throw new Error('Auth0 client not initialized');

    await client.loginWithPopup();

    const userData = await client.getUser();
    user.set(userData || null);
    isAuthenticated.set(true);

    // Store user data in our database
    if (userData) {
      await syncUserToApi(userData);
    }

    // Handle redirect after successful login
    const redirectPath = sessionStorage.getItem('redirectAfterLogin');
    if (redirectPath) {
      sessionStorage.removeItem('redirectAfterLogin');
      goto(redirectPath);
    }
  } catch (e) {
    error.set(e instanceof Error ? e.message : 'Unknown error');
    // If login fails, redirect to home
    goto('/');
  } finally {
    popupOpen.set(false);
  }
}

// Logout function
export async function logout() {
  try {
    const client = get(auth0Client);
    if (!client) throw new Error('Auth0 client not initialized');

    await client.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
    user.set(null);
    isAuthenticated.set(false);
  } catch (e) {
    error.set(e instanceof Error ? e.message : 'Unknown error');
  }
}
