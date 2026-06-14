export interface ListingInteractionState {
  contactInfo: {
    phone: string | null;
    email: string | null;
  };
  cachedContactInfo: {
    phone: string | null;
    email: string | null;
  };
  selectedImage: number | null;
  isLoading: boolean;
  error: string | null;
  showLoginPrompt: boolean;
  feedbackRating: number;
  feedbackComment: string;
  feedbackError: string | null;
  feedbackSuccess: string | null;
  isSubmittingFeedback: boolean;
  hasRevealedContact: boolean;
  trackedView: boolean;
}

export function createListingInteractionState(): ListingInteractionState {
  return {
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
  };
}

export function shouldResetListingInteractionState(
  previousListingId: number | null,
  nextListingId: number | null,
): boolean {
  return nextListingId !== null && previousListingId !== nextListingId;
}