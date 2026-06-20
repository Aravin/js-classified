// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import ImageUpload from './ImageUpload.svelte';

// Mock SvelteKit and other dependencies
vi.mock('$app/environment', () => ({
  browser: true,
}));

vi.mock('$lib/config', () => ({
  config: {
    api: {
      baseUrl: 'http://localhost:3000',
    },
  },
}));

vi.mock('$lib/auth/auth0', () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test-token' }),
  isAuthenticated: {
    subscribe: (fn: any) => {
      fn(true);
      return () => {};
    },
  },
  user: {
    subscribe: (fn: any) => {
      fn({ sub: 'user_123' });
      return () => {};
    },
  },
}));

vi.mock('@iconify/svelte', () => ({
  default: () => null,
}));

vi.mock('svelte-dnd-action', () => ({
  dndzone: () => {},
}));

describe('ImageUpload Component', () => {
  let target: HTMLDivElement;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
  });

  afterEach(() => {
    document.body.removeChild(target);
  });

  it('should render the ImageUpload component with initial state', () => {
    mount(ImageUpload, {
      target,
      props: {
        listingId: 123,
      },
    });

    const chooseButton = target.querySelector('button');
    expect(chooseButton).not.toBeNull();
    expect(chooseButton?.textContent).toContain('Choose Images');
    expect(chooseButton?.hasAttribute('disabled')).toBe(false);
  });

  it('should disable choose images and upload buttons and show loading spinner when an image is uploading', () => {
    // Mock a preview item with uploading = true
    const mockPreviewItem = {
      id: 'test-uuid-1',
      src: 'data:image/png;base64,mock',
      file: new File([], 'test.png', { type: 'image/png' }),
      uploading: true,
      error: null,
      order: 1,
    };

    mount(ImageUpload, {
      target,
      props: {
        listingId: 123,
        preview: [mockPreviewItem],
      },
    });

    // The Choose Images button should be disabled
    const chooseButton = target.querySelector('button');
    expect(chooseButton).not.toBeNull();
    expect(chooseButton?.hasAttribute('disabled')).toBe(true);

    // The Upload/Submit button should show "Uploading..."
    const uploadButton = target.querySelector('button[type="button"]:not(.hidden)');
    // Wait, the choose button is type="button" too. Let's find the bottom button (which has "Uploading..." text)
    const buttons = target.querySelectorAll('button');
    const bottomButton = Array.from(buttons).find((b) => b.textContent?.includes('Uploading...'));
    expect(bottomButton).toBeDefined();
    expect(bottomButton?.hasAttribute('disabled')).toBe(true);
  });
});
