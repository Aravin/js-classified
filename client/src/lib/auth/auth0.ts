import { Auth0Client, User } from '@auth0/auth0-spa-js';
import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { config } from '$lib/config';
import { goto } from '$app/navigation';

// Create stores
export const isAuthenticated = writable(false);
export const user = writable<User | null>(null);
export const auth0Client = writable<Auth0Client | null>(null);
export const popupOpen = writable(false);
export const error = writable<string | null>(null);
export const isInitializing = writable(true);
export const isLoading = writable(true);

let _auth0Client: Auth0Client;

export async function initAuth0() {
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
        redirect_uri: config.auth0.callbackUrl
      },
      cacheLocation: 'localstorage'
    });

    auth0Client.set(_auth0Client);

    // Check authentication state
    if (browser) {
      try {
        const isAuth = await _auth0Client.isAuthenticated();
        isAuthenticated.set(isAuth);

        if (isAuth) {
          const userProfile = await _auth0Client.getUser();
          user.set(userProfile || null);
        }
      } catch (err) {
        console.error('Error checking authentication', err);
      }
    }
  } catch (err) {
    console.error('Error initializing auth0', err);
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
    isLoading: $isLoading
  })
);

// Initialize the Auth0 client
initAuth0();

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
      try {
        const apiUrl = `${config.api.baseUrl}/users`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: userData.sub,
            email: userData.email,
            fullName: userData.name,
            avatar: userData.picture
          })
        });

        if (!response.ok) {
          console.error('Failed to store user data:', await response.text());
        }
      } catch (e) {
        console.error('Error storing user data:', e);
      }
    }

    // Handle redirect after successful login
    const redirectPath = sessionStorage.getItem('redirectAfterLogin');
    if (redirectPath) {
      sessionStorage.removeItem('redirectAfterLogin');
      goto(redirectPath);
    }
  } catch (e) {
    console.error('Error logging in:', e);
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
        returnTo: window.location.origin
      }
    });
    user.set(null);
    isAuthenticated.set(false);
  } catch (e) {
    console.error('Error logging out:', e);
    error.set(e instanceof Error ? e.message : 'Unknown error');
  }
}