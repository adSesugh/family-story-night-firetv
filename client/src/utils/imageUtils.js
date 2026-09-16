/**
 * Image Utilities for Family Story Night
 * Handles converting image Blobs to Data URLs and compressing them for localStorage storage.
 */

/**
 * Converts a Blob to a base64 Data URL.
 * Works across browser FileReader and Node/JSDOM Buffer environments.
 *
 * @param {Blob} blob
 * @returns {Promise<string | null>}
 */
export async function blobToDataUrl(blob) {
  if (!blob) return null;
  try {
    if (typeof FileReader !== "undefined") {
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } else if (blob.arrayBuffer) {
      const buffer = await blob.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mime = blob.type || "image/png";
      return `data:${mime};base64,${base64}`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Compresses an image blob to a lightweight JPEG Data URL (max width 480px, quality 0.7)
 * to ensure persistent storage in localStorage without exhausting browser quota limits.
 *
 * @param {Blob} blob
 * @param {number} [maxWidth=480]
 * @param {number} [quality=0.7]
 * @returns {Promise<string | null>}
 */
export async function compressBlobToDataUrl(blob, maxWidth = 480, quality = 0.7) {
  if (!blob) return null;
  // Use canvas compression in real browser environments; fall back to blobToDataUrl in JSDOM/Node
  const isJsdom = typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.includes("jsdom");
  if (!isJsdom && typeof document !== "undefined" && typeof Image !== "undefined" && typeof HTMLCanvasElement !== "undefined") {
    try {
      const objectUrl = typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null;
      if (objectUrl) {
        const img = new Image();
        const loaded = await new Promise((resolve) => {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          // Safety timeout so it never hangs
          setTimeout(() => resolve(false), 300);
          img.src = objectUrl;
        });

        if (loaded) {
          const canvas = document.createElement("canvas");
          let width = img.width || maxWidth;
          let height = img.height || maxWidth;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            if (typeof URL.revokeObjectURL === "function") {
              URL.revokeObjectURL(objectUrl);
            }
            return canvas.toDataURL("image/jpeg", quality);
          }
        }
      }
    } catch {
      // Fall through to plain data URL
    }
  }
  return await blobToDataUrl(blob);
}
