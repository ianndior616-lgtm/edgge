/**
 * Обработка изображений на клиенте: чтение файла, центральная обрезка
 * и адаптивное сжатие (чтобы data URL не ломал запросы на телефонах).
 */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("bad image"));
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}

function cropCenter(
  img: HTMLImageElement,
  targetRatio: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const srcRatio = img.naturalWidth / img.naturalHeight;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (srcRatio > targetRatio) {
    sw = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

/**
 * Квадратная аватарка: центр-обрезка + адаптивное сжатие (обычно 20–80 КБ).
 */
export async function formatAvatar(file: File): Promise<string> {
  const raw = await fileToDataUrl(file);
  const img = await loadImage(raw);

  const steps: Array<[number, number]> = [
    [512, 0.85],
    [320, 0.8],
    [192, 0.72],
  ];
  for (const [size, quality] of steps) {
    const out = drawAvatar(img, size, quality);
    if (out.length <= 150_000) return out;
  }
  return drawAvatar(img, 128, 0.6);
}

function drawAvatar(
  img: HTMLImageElement,
  size: number,
  quality: number,
): string {
  const { sx, sy, sw, sh } = cropCenter(img, 1);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Картинка карточки рекомендаций: центр-обрезка до 16:9
 * и адаптивное сжатие (обычно 30–120 КБ).
 */
export async function formatBanner(file: File): Promise<string> {
  const raw = await fileToDataUrl(file);
  const img = await loadImage(raw);

  const steps: Array<[number, number]> = [
    [900, 0.85],
    [640, 0.8],
    [480, 0.75],
  ];
  for (const [width, quality] of steps) {
    const out = drawBanner(img, width, quality);
    if (out.length <= 160_000) return out;
  }
  return drawBanner(img, 400, 0.65);
}

function drawBanner(
  img: HTMLImageElement,
  width: number,
  quality: number,
): string {
  const ratio = 16 / 9;
  const { sx, sy, sw, sh } = cropCenter(img, ratio);
  const height = Math.round(width / ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
