import Jimp from 'jimp';

/**
 * Applies a semi-transparent watermark banner and text ("locful.com")
 * to the bottom-right corner of an image buffer.
 * This helps override/hide any existing watermarks (e.g. OLX) on crawled images.
 * 
 * @param imageBuffer The original image buffer.
 * @returns A Promise resolving to the watermarked image buffer as JPEG.
 */
export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const image = await Jimp.read(imageBuffer);
    
    // Load a clean white sans-serif font
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const text = 'locful.com';
    
    const textWidth = Jimp.measureText(font, text);
    const textHeight = Jimp.measureTextHeight(font, text, image.getWidth());
    
    const padding = 12;
    const x = image.getWidth() - textWidth - padding;
    const y = image.getHeight() - textHeight - padding;
    
    // Define the bounding box for the background banner
    const boxWidth = textWidth + padding * 2;
    const boxHeight = textHeight + padding * 2;
    const boxX = Math.max(0, x - padding);
    const boxY = Math.max(0, y - padding);
    
    // Create a semi-transparent black background block (RGBA: 0, 0, 0, 0.7)
    // In Jimp, hex colors are in RGBA format
    const backgroundColor = 0x000000b2; // 'b2' is ~70% opacity in hex
    const backgroundBox = new Jimp(boxWidth, boxHeight, backgroundColor);
    
    // Overlay the background box onto the original image
    image.composite(backgroundBox, boxX, boxY);
    
    // Overlay the watermark text
    image.print(font, x, y, text);
    
    // Export the modified image as JPEG buffer
    return await image.getBufferAsync(Jimp.MIME_JPEG);
  } catch (error) {
    console.error('Error applying watermark:', error);
    // Return original buffer as fallback in case of processing errors
    return imageBuffer;
  }
}
