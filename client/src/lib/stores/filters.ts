import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Initialize from localStorage if available
const storedLocation = browser ? localStorage.getItem('selectedLocation') : null;
const storedCategory = browser ? localStorage.getItem('selectedCategory') : null;

// Create stores with initial values
export const selectedLocation = writable<string>(
    storedLocation || ''
);
export const selectedCategory = writable<string>(
    storedCategory || ''
);

// Subscribe to changes and update localStorage
if (browser) {
    selectedLocation.subscribe(value => {
        if (value) {
            localStorage.setItem('selectedLocation', value);
        } else {
            localStorage.removeItem('selectedLocation');
        }
    });

    selectedCategory.subscribe(value => {
        if (value) {
            localStorage.setItem('selectedCategory', value);
        } else {
            localStorage.removeItem('selectedCategory');
        }
    });
}