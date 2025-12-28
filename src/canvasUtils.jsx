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

// NEW: Resize helper to speed up AI
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

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

// ... (Keep rotateSize, getCroppedImg, and generatePrintSheet exactly as they were in the previous code) ...
// Copy the rest of the file from the previous answer.
// Ensure generatePrintSheet and getCroppedImg are still there!

function rotateSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

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

export async function generatePrintSheet(photoUrl, sheetSize) {
  const originalPhoto = await createImage(photoUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const DPI = 300;
  const photoW = 1.38 * DPI; 
  const photoH = 1.78 * DPI; 

  let layout = {};

  if (sheetSize === 'A4') {
     layout = { width: 8.27 * DPI, height: 11.69 * DPI, cols: 5, rows: 6 };
  } else {
     layout = { width: 6 * DPI, height: 4 * DPI, cols: 4, rows: 2 };
  }

  canvas.width = layout.width;
  canvas.height = layout.height;

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const totalGridWidth = (layout.cols * photoW);
  const totalGridHeight = (layout.rows * photoH);

  const spaceX = (layout.width - totalGridWidth) / (layout.cols + 1);
  const spaceY = (layout.height - totalGridHeight) / (layout.rows + 1);

  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const x = spaceX + (c * (photoW + spaceX));
      const y = spaceY + (r * (photoH + spaceY));

      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, photoW, photoH);

      ctx.drawImage(originalPhoto, x, y, photoW, photoH);
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob));
    }, 'image/jpeg', 1.0);
  });
}