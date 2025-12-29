// src/canvasUtils.js

// 1. Helper to load image
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

// 2. Helper to resize image (speed optimization)
export async function resizeImage(imageUrl, maxWidth = 1024) {
  const image = await createImage(imageUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let width = image.width;
  let height = image.height;

  // Scale down if too big
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.9);
  });
}

// 3. Math Helper for Rotation
function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

// 4. Calculate bounding box after rotation
function rotateSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

// 5. Crop the image based on user selection
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, backgroundColor = null) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(getRadianAngle(rotation));
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = pixelCrop.width;
  tempCanvas.height = pixelCrop.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(data, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0);

  return canvas.toDataURL('image/jpeg', 1.0);
}

// 6. Generate the Print Sheet (Matches your Screenshot)
export async function generatePrintSheet(photoUrl, sheetSize) {
  const originalPhoto = await createImage(photoUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const DPI = 300;
  // Standard Passport Size Dimensions
  const photoW = 1.38 * DPI; 
  const photoH = 1.78 * DPI; 

  let layout = {};

  if (sheetSize === 'A4') {
    // A4 Portrait: 5 columns, 6 rows (Upright photos)
    layout = { width: 8.27 * DPI, height: 11.69 * DPI, cols: 5, rows: 6, rotate: false };
  } else {
    // 4x6 Portrait with ROTATED photos (Like your screenshot)
    // Width: 4 inches, Height: 6 inches
    // Fits 2 columns, 4 rows (Total 8 photos)
    layout = { width: 4 * DPI, height: 6 * DPI, cols: 2, rows: 4, rotate: true };
  }

  canvas.width = layout.width;
  canvas.height = layout.height;

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // If rotating, the "slot" size on the paper is swapped
  const slotW = layout.rotate ? photoH : photoW;
  const slotH = layout.rotate ? photoW : photoH;

  const totalGridWidth = (layout.cols * slotW);
  const totalGridHeight = (layout.rows * slotH);

  const spaceX = (layout.width - totalGridWidth) / (layout.cols + 1);
  const spaceY = (layout.height - totalGridHeight) / (layout.rows + 1);

  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const x = spaceX + (c * (slotW + spaceX));
      const y = spaceY + (r * (slotH + spaceY));

      if (layout.rotate) {
        // ROTATION LOGIC (For 4x6 8-up layout)
        const centerX = x + slotW / 2;
        const centerY = y + slotH / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        // Rotate -90 degrees (heads pointing left) to match screenshot
        ctx.rotate(-Math.PI / 2); 
        
        // Draw photo centered in the rotated context
        ctx.drawImage(originalPhoto, -photoW / 2, -photoH / 2, photoW, photoH);
        
        // Draw cut lines
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.strokeRect(-photoW / 2, -photoH / 2, photoW, photoH);
        
        ctx.restore();
      } else {
        // STANDARD LOGIC (For A4)
        ctx.drawImage(originalPhoto, x, y, photoW, photoH);
        
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, photoW, photoH);
      }
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob));
    }, 'image/jpeg', 1.0);
  });
}
