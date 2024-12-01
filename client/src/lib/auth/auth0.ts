import { createAuth0Client, type Auth0Client, type Auth0ClientOptions, type User } from '@auth0/auth0-spa-js';
import { writable, get, type Writable } from 'svelte/store';
import { env } from '$env/dynamic/public';
import { config } from '$lib/config';
import { goto } from '$app/navigation';

// Auth0 configuration
const auth0Config: Auth0ClientOptions = {
    domain: env.PUBLIC_AUTH0_DOMAIN + '',
    clientId: env.PUBLIC_AUTH0_CLIENT_ID + '',
    authorizationParams: {
        redirect_uri: env.PUBLIC_AUTH0_CALLBACK_URL
    }
};

// Create stores
export const isAuthenticated: Writable<boolean> = writable(false);
export const user: Writable<User | null> = writable(null);
export const auth0Client: Writable<Auth0Client | null> = writable(null);
export const popupOpen: Writable<boolean> = writable(false);
export const error: Writable<string | null> = writable(null);
export const isLoading: Writable<boolean> = writable(true);

async function createClient() {
    try {
        const client = await createAuth0Client(auth0Config);
        auth0Client.set(client);

        // Check if user is authenticated
        const loggedIn = await client.isAuthenticated();
        isAuthenticated.set(loggedIn);

        if (loggedIn) {
            // Get user data
            const userData = await client.getUser();
            user.set(userData || null);
        }
    } catch (e) {
        console.error('Error initializing Auth0 client:', e);
        error.set(e instanceof Error ? e.message : 'Unknown error');
    } finally {
        isLoading.set(false);
    }
}

// Initialize the Auth0 client
createClient();

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