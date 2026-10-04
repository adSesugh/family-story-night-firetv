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

  // SVGs are vector graphics: NEVER rasterize to canvas!
  // Rasterizing SVG to a canvas destroys infinite vector resolution and degrades into a blurry raster image.
  if (blob.type === "image/svg+xml") {
    return await blobToDataUrl(blob);
  }

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
 * Creates a theme-tailored watercolor SVG Data URL as a guaranteed, ultra-crisp illustration fallback.
 * Uses high-resolution dimensions (1024x1280) and chapter-aware palette harmonies so vectors never blur on 1080p/4K TVs.
 *
 * @param {string} [theme="Bedtime Adventure"]
 * @param {number} [pageNum=1]
 * @param {number} [chapter=1]
 * @returns {string} Data URL containing SVG illustration
 */
export function createFallbackIllustrationUrl(theme = "Bedtime Adventure", pageNum = 1, chapter = 1) {
  const safeTheme = String(theme).replace(/[<>&"]/g, "").slice(0, 32);
  const chNum = Number(chapter) || 1;
  const pNum = Number(pageNum) || 1;

  // Chapter-specific harmonious bedtime palettes
  let skyTop = "#080f24";
  let skyMid = "#162244";
  let skyBottom = "#2f2249";
  let hillBackTop = "#1f2c45";
  let hillBackBottom = "#0d1624";
  let hillFrontTop = "#131e33";
  let hillFrontBottom = "#070c14";
  let moonTint = "#fff8db";
  let moonGlow = "#fcd34d";
  let starColor = "#fef08a";
  let horizonWarmth = "#e8a33d";

  if (chNum === 2) {
    // Chapter 2: Enchanted starlit aurora & teal woodland depth
    skyTop = "#05161b";
    skyMid = "#0f2b34";
    skyBottom = "#1f3b45";
    hillBackTop = "#16343b";
    hillBackBottom = "#09191d";
    hillFrontTop = "#0d2328";
    hillFrontBottom = "#040d0f";
    moonTint = "#f0fdf4";
    moonGlow = "#6ee7b7";
    starColor = "#a7f3d0";
    horizonWarmth = "#34d399";
  } else if (chNum >= 3) {
    // Chapter 3+: Celestial royal indigo, velvet amethyst & rose twilight
    skyTop = "#120921";
    skyMid = "#24133b";
    skyBottom = "#441d4f";
    hillBackTop = "#331843";
    hillBackBottom = "#16071e";
    hillFrontTop = "#220e2e";
    hillFrontBottom = "#0b0310";
    moonTint = "#fff1f2";
    moonGlow = "#f472b6";
    starColor = "#fbcfe8";
    horizonWarmth = "#fb7185";
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1280" width="1024" height="1280" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${skyTop}"/>
        <stop offset="55%" stop-color="${skyMid}"/>
        <stop offset="100%" stop-color="${skyBottom}"/>
      </linearGradient>
      <radialGradient id="celestialGlow" cx="72%" cy="22%" r="48%">
        <stop offset="0%" stop-color="${moonTint}" stop-opacity="1"/>
        <stop offset="28%" stop-color="${moonGlow}" stop-opacity="0.85"/>
        <stop offset="65%" stop-color="${horizonWarmth}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${skyMid}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="hillBack" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${hillBackTop}"/>
        <stop offset="100%" stop-color="${hillBackBottom}"/>
      </linearGradient>
      <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${hillFrontTop}"/>
        <stop offset="100%" stop-color="${hillFrontBottom}"/>
      </linearGradient>
    </defs>
    <!-- Crisp Vector Sky Background -->
    <rect width="1024" height="1280" fill="url(#skyGrad)"/>
    <!-- Glowing Celestial Moon -->
    <circle cx="740" cy="280" r="220" fill="url(#celestialGlow)"/>
    <circle cx="740" cy="280" r="68" fill="#fffdfa"/>
    <circle cx="724" cy="272" r="62" fill="${moonTint}" opacity="0.3"/>
    <!-- Twinkling Constellations (Ultra-sharp vector circles) -->
    <g fill="${starColor}" opacity="0.9">
      <circle cx="160" cy="140" r="3.5"/><circle cx="320" cy="220" r="2.8"/><circle cx="480" cy="120" r="4"/>
      <circle cx="120" cy="320" r="2.5"/><circle cx="400" cy="360" r="3"/><circle cx="900" cy="180" r="3.8"/>
      <circle cx="620" cy="340" r="3.2"/><circle cx="220" cy="500" r="3.6"/><circle cx="850" cy="420" r="2.8"/>
      <circle cx="280" cy="260" r="2"/><circle cx="560" cy="200" r="2.4"/><circle cx="70" cy="180" r="3"/>
      <circle cx="960" cy="300" r="2.6"/><circle cx="440" cy="480" r="3.2"/><circle cx="680" cy="460" r="2.2"/>
    </g>
    <!-- Rolling Bedtime Hills -->
    <path d="M-30,840 Q280,660 580,800 T1060,740 L1060,1320 L-30,1320 Z" fill="url(#hillBack)" opacity="0.8"/>
    <path d="M-30,960 Q340,820 690,950 T1060,910 L1060,1320 L-30,1320 Z" fill="url(#hillFront)"/>
    <!-- Soft Warm Horizon Glow -->
    <ellipse cx="512" cy="1240" rx="460" ry="140" fill="${horizonWarmth}" opacity="0.2"/>
    <!-- Theme & Chapter Watermark -->
    <text x="512" y="1160" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="34" fill="#fef3c7" opacity="0.88">✦ ${safeTheme}${chNum > 1 ? ` · Chapter ${chNum}` : ""} ✦</text>
    <text x="512" y="1210" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="18" letter-spacing="4" fill="${horizonWarmth}" opacity="0.8">PAGE ${pNum}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
