// Shared client-side image helpers used by the submit form and the creator
// project editor. All functions rely on browser APIs (FileReader, Image,
// canvas) and must only run in the browser.

// Below this data-URL size we keep the original untouched — small images aren't
// worth re-encoding.
const OPTIMIZE_SKIP_BYTES = 1_400_000;
// Longest edge (px) the optimized image is scaled down to.
const MAX_DIMENSION = 1600;
// JPEG quality for the re-encoded output (PNGs are re-encoded losslessly).
const JPEG_QUALITY = 0.84;

export function loadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Die Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Das Bild konnte nicht verarbeitet werden."));
    image.src = src;
  });
}

export async function optimizeImageFile(file) {
  const dataUrl = await loadFileAsDataUrl(file);

  if (file.type === "image/svg+xml" || dataUrl.length <= OPTIMIZE_SKIP_BYTES) {
    return dataUrl;
  }

  const image = await loadImageElement(dataUrl);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)
  );
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  const targetType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const optimized = canvas.toDataURL(targetType, targetType === "image/png" ? undefined : JPEG_QUALITY);

  return optimized.length < dataUrl.length ? optimized : dataUrl;
}
