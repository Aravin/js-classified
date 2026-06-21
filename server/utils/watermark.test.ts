import { describe, it, expect } from 'vitest';
import Jimp from 'jimp';
import { applyWatermark } from './watermark';

describe('applyWatermark', () => {
  it('should successfully apply watermark and return a valid JPEG buffer', async () => {
    // Create a 200x200 red test image
    const image = new Jimp(300, 200, 0xFF0000FF);
    const originalBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

    // Apply watermark
    const watermarkedBuffer = await applyWatermark(originalBuffer);
    
    expect(watermarkedBuffer).toBeInstanceOf(Buffer);
    expect(watermarkedBuffer.length).toBeGreaterThan(0);

    // Load it back into Jimp to verify correctness
    const watermarkedImage = await Jimp.read(watermarkedBuffer);
    expect(watermarkedImage.getWidth()).toBe(300);
    expect(watermarkedImage.getHeight()).toBe(200);
  });

  it('should return the original buffer on invalid image inputs without crashing', async () => {
    const invalidBuffer = Buffer.from('not-an-image');
    const result = await applyWatermark(invalidBuffer);
    expect(result).toBe(invalidBuffer);
  });
});
