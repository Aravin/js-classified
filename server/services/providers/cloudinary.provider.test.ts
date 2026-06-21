import { beforeEach, describe, expect, it, vi } from 'vitest';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryProvider } from './cloudinary.provider';

vi.mock('cloudinary', () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      destroy: vi.fn(),
    },
    url: vi.fn(),
  },
}));

describe('CloudinaryProvider.delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats already-missing assets as successfully deleted', async () => {
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'not found' } as any);

    const provider = new CloudinaryProvider();
    await expect(provider.delete('classified/missing-image')).resolves.toBe(true);
  });

  it('returns true when Cloudinary confirms deletion', async () => {
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: 'ok' } as any);

    const provider = new CloudinaryProvider();
    await expect(provider.delete('classified/existing-image')).resolves.toBe(true);
  });
});
