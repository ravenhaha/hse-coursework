// Возвращает File (image/jpeg) с обрезанной квадратной областью
export async function getCroppedImageFile(
  imageSrc,
  croppedAreaPixels,
  fileName = 'avatar.jpg',
) {
  const image = await loadImage(imageSrc);

  // Берём квадрат: react-easy-crop при aspect=1 уже отдаёт квадратную область,
  // но на всякий случай нормализуем.
  const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    size,
    size,
  );

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  );

  if (!blob) {
    throw new Error('Не удалось сформировать изображение');
  }

  return new File([blob], fileName, { type: 'image/jpeg' });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Для dataURL не нужно, но не мешает при работе с http-источниками.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = src;
  });
}