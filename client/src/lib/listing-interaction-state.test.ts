import { describe, expect, it } from 'vitest';
import {
  createListingInteractionState,
  shouldResetListingInteractionState,
} from './listing-interaction-state';

describe('createListingInteractionState', () => {
  it('returns fresh per-listing defaults for tracking and feedback state', () => {
    expect(createListingInteractionState()).toEqual({
      contactInfo: {
        phone: null,
        email: null,
      },
      cachedContactInfo: {
        phone: null,
        email: null,
      },
      selectedImage: null,
      isLoading: false,
      error: null,
      showLoginPrompt: false,
      feedbackRating: 0,
      feedbackComment: '',
      feedbackError: null,
      feedbackSuccess: null,
      isSubmittingFeedback: false,
      hasRevealedContact: false,
      trackedView: false,
    });
  });
});

describe('shouldResetListingInteractionState', () => {
  it('resets on first load and when navigating to a different listing', () => {
    expect(shouldResetListingInteractionState(null, 12)).toBe(true);
    expect(shouldResetListingInteractionState(12, 15)).toBe(true);
  });

  it('does not reset when staying on the same listing or when no listing exists yet', () => {
    expect(shouldResetListingInteractionState(12, 12)).toBe(false);
    expect(shouldResetListingInteractionState(null, null)).toBe(false);
  });
});