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
 * Compresses an image blob to a crisp, high-resolution Data URL (max width 1024px, quality 0.88)
 * using WebP (with JPEG fallback) to ensure sharp, unblurred illustration display on TV and mobile screens
 * while maintaining efficient storage in the database and local cache.
 *
 * @param {Blob} blob
 * @param {number} [maxWidth=1024]
 * @param {number} [quality=0.88]
 * @returns {Promise<string | null>}
 */
export async function compressBlobToDataUrl(blob, maxWidth = 1024, quality = 0.88) {
  if (!blob) return null;

  // If the blob is already reasonably compact (<= 250KB) and in a web-friendly format, preserve it directly without re-encoding loss
  if (blob.size && blob.size <= 250 * 1024 && (blob.type === "image/webp" || blob.type === "image/jpeg")) {
    const rawDataUrl = await blobToDataUrl(blob);
    if (rawDataUrl) return rawDataUrl;
  }

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
          // Generous timeout so high-res images have time to decode
          setTimeout(() => resolve(false), 2000);
          img.src = objectUrl;
        });

        if (loaded) {
          const canvas = document.createElement("canvas");
          let width = img.width || maxWidth;
          let height = img.height || maxWidth;

          // Only downscale if the image exceeds maxWidth
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { alpha: false });
          if (ctx) {
            // Enable high quality image scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);

            if (typeof URL.revokeObjectURL === "function") {
              URL.revokeObjectURL(objectUrl);
            }

            // Prefer WebP for crisp sharp details with zero JPEG blockiness; fall back to high quality JPEG
            try {
              const webpDataUrl = canvas.toDataURL("image/webp", quality);
              if (webpDataUrl && webpDataUrl.startsWith("data:image/webp")) {
                return webpDataUrl;
              }
            } catch {
              // Ignore and use JPEG fallback
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

/**
 * Creates a theme-tailored watercolor SVG Data URL as a guaranteed illustration fallback.
 *
 * @param {string} [theme="Bedtime Adventure"]
 * @param {number} [pageNum=1]
 * @returns {string} Data URL containing SVG illustration
 */
export function createFallbackIllustrationUrl(theme = "Bedtime Adventure", pageNum = 1) {
  const safeTheme = String(theme).replace(/[<>&"]/g, "").slice(0, 32);
  const hueShift = (Number(pageNum) * 45) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 800" width="100%" height="100%">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0c122b"/>
        <stop offset="60%" stop-color="#19284d"/>
        <stop offset="100%" stop-color="#3c305c"/>
      </linearGradient>
      <radialGradient id="celestialGlow" cx="70%" cy="22%" r="45%">
        <stop offset="0%" stop-color="#fff8db" stop-opacity="1"/>
        <stop offset="25%" stop-color="#fcd34d" stop-opacity="0.85"/>
        <stop offset="65%" stop-color="#f59e0b" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#19284d" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="hillBack" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#243452"/>
        <stop offset="100%" stop-color="#0e1726"/>
      </linearGradient>
      <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#17243b"/>
        <stop offset="100%" stop-color="#070c14"/>
      </linearGradient>
    </defs>
    <rect width="640" height="800" fill="url(#skyGrad)"/>
    <circle cx="460" cy="180" r="130" fill="url(#celestialGlow)"/>
    <circle cx="460" cy="180" r="42" fill="#fffdfa"/>
    <!-- Twinkling Stars -->
    <g fill="#fef08a" opacity="0.85">
      <circle cx="110" cy="90" r="2.5"/><circle cx="210" cy="140" r="2"/><circle cx="310" cy="80" r="2.8"/>
      <circle cx="80" cy="210" r="1.8"/><circle cx="260" cy="240" r="2.2"/><circle cx="560" cy="110" r="2.5"/>
      <circle cx="390" cy="220" r="2.4"/><circle cx="140" cy="330" r="2.6"/><circle cx="530" cy="270" r="2"/>
    </g>
    <!-- Bedtime Rolling Hills -->
    <path d="M-20,530 Q170,410 360,500 T660,460 L660,820 L-20,820 Z" fill="url(#hillBack)" opacity="0.75"/>
    <path d="M-20,610 Q210,510 430,600 T660,570 L660,820 L-20,820 Z" fill="url(#hillFront)"/>
    <ellipse cx="320" cy="780" rx="280" ry="90" fill="#e8a33d" opacity="0.18"/>
    <!-- Theme & Chapter Watermark -->
    <text x="320" y="730" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="22" fill="#fef3c7" opacity="0.8">✦ ${safeTheme} ✦</text>
    <text x="320" y="760" text-anchor="middle" font-family="sans-serif" font-size="12" letter-spacing="2" fill="#e8a33d" opacity="0.7">PAGE ${pageNum}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
