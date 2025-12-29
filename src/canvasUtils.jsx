/**
 * canvasUtils.js
 */

// Helper: Load an image safely ensuring it is fully ready
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * 1. GET CROPPED IMG
 * Takes the source image and crop data, returns a Base64 JPEG.
 */
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, bgColor = '#ffffff') {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  // set each dimensions to double largest dimension to allow for a safe area for the
  // image to rotate in without being clipped by canvas context
  canvas.width = safeArea;
  canvas.height = safeArea;

  // Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Translate & Rotate
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  // Draw original image
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  // Extract the cropped data
  const data = ctx.getImageData(
    safeArea / 2 - image.width * 0.5 + pixelCrop.x,
    safeArea / 2 - image.height * 0.5 + pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  );

  // Resize canvas to final crop size
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Paste data
  ctx.putImageData(data, 0, 0);

  // Return Base64
  return canvas.toDataURL('image/jpeg');
}

/**
 * 2. GENERATE PRINT SHEET
 * - Maintains order (Sequence)
 * - Centers grid on 4x6 (Equal Margins)
 * - Fits 30 photos on A4
 */
export const generatePrintSheet = async (imageUrls, layoutType) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // --- CONFIGURATION ---
  let canvasWidth, canvasHeight, photoWidth, photoHeight, gap, cols, maxRows;

  if (layoutType === '6x4') {
    // 4x6 inch (Landscape: 1800 x 1200 px @ 300 DPI)
    canvasWidth = 1800;
    canvasHeight = 1200;
    cols = 4;           // Fits 4 across
    maxRows = 2;        // Fits 2 down (Total 8)
    photoWidth = 413;   // ~35mm
    photoHeight = 531;  // ~45mm
    gap = 30;           // Comfortable gap
  } else {
    // A4 (Portrait: 2480 x 3508 px @ 300 DPI)
    canvasWidth = 2480;
    canvasHeight = 3508;
    cols = 5;           // Fits 5 across
    maxRows = 6;        // Fits 6 down (Total 30)
    photoWidth = 413;
    photoHeight = 531;
    gap = 25;           // Tighter gap to ensure 6 rows fit
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Fill White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // --- CENTERING MATH ---
  
  // 1. Calculate the full width/height of the grid of photos
  const totalGridWidth = (cols * photoWidth) + ((cols - 1) * gap);
  
  // For height, we calculate based on the specific layout max rows
  const totalGridHeight = (maxRows * photoHeight) + ((maxRows - 1) * gap);

  // 2. Calculate Starting X (Left Margin) to center horizontally
  const startX = (canvasWidth - totalGridWidth) / 2;

  // 3. Calculate Starting Y (Top Margin) to center vertically
  const startY = (canvasHeight - totalGridHeight) / 2;

  try {
    // Load ALL images first to guarantee sequence order [0, 1, 2, 3...]
    const loadedImages = await Promise.all(imageUrls.map(url => createImage(url)));

    // Draw them
    loadedImages.forEach((img, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = startX + (col * (photoWidth + gap));
      const y = startY + (row * (photoHeight + gap));

      // Draw only if within canvas bounds
      if (y + photoHeight < canvasHeight) {
        ctx.drawImage(img, x, y, photoWidth, photoHeight);
        
        // Optional: Draw cut lines (light grey border)
        // ctx.strokeStyle = '#dddddd';
        // ctx.lineWidth = 1;
        // ctx.strokeRect(x, y, photoWidth, photoHeight);
      }
    });

  } catch (e) {
    console.error("Error generating sheet:", e);
  }

  // Return blob for preview
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.9);
  });
};

// Placeholder
export const resizeImage = (file) => file;
