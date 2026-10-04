import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import dotenv from "dotenv";

dotenv.config();

const IMAGE_MODEL_ID = process.env.BEDROCK_IMAGE_MODEL_ID || "stability.stable-image-core-v1:1";
// Stability AI Image Core is best supported in us-west-2
const IMAGE_REGION = process.env.BEDROCK_IMAGE_REGION || "us-west-2";

const bedrockImage = new BedrockRuntimeClient({ region: IMAGE_REGION });

/**
 * Creates a beautiful SVG watercolor bedtime scene used as an emergency fallback
 * if AI image generation is unavailable or exhausted.
 * Creates a high-DPI (1024x1280) bedtime watercolor SVG as a crisp fallback.
 * Uses chapter-specific color harmonies and explicit pixel dimensions so vectors never blur.
 *
 * @param {string} theme
 * @param {number} [chapter=1]
 * @param {number} [pageNum=1]
 * @returns {string} SVG XML string
 */
export function createBedtimeFallbackSvg(theme = "Bedtime Adventure", chapter = 1, pageNum = 1) {
  const safeTheme = String(theme).replace(/[<>&"]/g, "").slice(0, 36);
  const chNum = Number(chapter) || 1;
  const pNum = Number(pageNum) || 1;

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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1280" width="1024" height="1280" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">
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
}

/**
 * Clean narrative page text to extract concrete visual elements if no dedicated scene prompt exists.
 */
export function extractVisualScene(pageText, theme) {
  if (!pageText) return theme || "a cozy bedtime story";
  // Strip dialogue and non-visual conversational filler
  let cleaned = pageText
    .replace(/"[^"]*"/g, "")
    .replace(/“[^”]*”/g, "")
    .replace(/\b(he said|she said|they said|he whispered|she whispered|they smiled|suddenly|remembered|thought to himself|felt a sense of|wondered)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 15) {
    cleaned = pageText.slice(0, 300);
  }
  return cleaned.slice(0, 320);
}

export const DEFAULT_NEGATIVE_PROMPT =
  "text, words, letters, watermark, signature, logo, blurry, deformed, ugly, bad anatomy, extra limbs, disfigured, low quality, pixelated, scary, dark, horror, adult content, realistic photo, photograph";

/**
 * Generates an illustration using a self-hosted or Kaggle ngrok endpoint.
 * @param {string} promptText
 * @param {string} pageText
 * @param {string} [negativePrompt]
 * @returns {Promise<{url: string, alt: string} | null>}
 */
export async function generateKaggleIllustration(promptText, pageText = "", negativePrompt = DEFAULT_NEGATIVE_PROMPT) {
  const kaggleUrl = process.env.KAGGLE_NGROK_URL || process.env.ILLUSTRATION_API_URL;
  if (!kaggleUrl) return null;

  const endpoint = kaggleUrl.endsWith("/generate")
    ? kaggleUrl
    : `${kaggleUrl.replace(/\/+$/, "")}/generate`;

  console.log(`[Illustrate] 🎨 Routing illustration to KAGGLE NGROK endpoint: ${endpoint}`);
  console.log(`[Illustrate] 📝 Prompt: "${promptText.slice(0, 150)}${promptText.length > 150 ? "..." : ""}"`);

  const startTime = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      "User-Agent": "FamilyStoryNight-Backend/1.0",
    },
    body: JSON.stringify({
      prompt: promptText,
      negative_prompt: negativePrompt,
    }),
  });

  if (!response.ok) {
    const errorDetails = await response.text().catch(() => "");
    throw new Error(`Kaggle ngrok error ${response.status} (${response.statusText}): ${errorDetails.slice(0, 300)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let base64Image = null;

  if (contentType.includes("application/json")) {
    const data = await response.json();
    const raw = data.image || data.images?.[0] || data.output || data.b64_json || data.result;
    if (raw) {
      base64Image = String(raw).replace(/^data:image\/\w+;base64,/, "");
    } else if (data.url && typeof data.url === "string") {
      console.log(`[Illustrate] ✅ KAGGLE NGROK generated image URL in ${Date.now() - startTime}ms: ${data.url}`);
      return {
        url: data.url,
        alt: `Illustration for: ${pageText.slice(0, 80)}`,
        engine: "kaggle-ngrok",
      };
    }
  } else if (contentType.includes("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    base64Image = Buffer.from(arrayBuffer).toString("base64");
  } else {
    const textData = await response.text();
    const clean = textData.trim().replace(/^data:image\/\w+;base64,/, "").replace(/^"|"$/g, "");
    if (clean.length > 50) {
      base64Image = clean;
    }
  }

  if (base64Image) {
    const sizeKb = Math.round((base64Image.length * 0.75) / 1024);
    console.log(`[Illustrate] ✅ KAGGLE NGROK successfully generated illustration in ${Date.now() - startTime}ms (~${sizeKb} KB)`);
    const isJpeg = base64Image.startsWith("/9j/") || (contentType && contentType.includes("jpeg"));
    const mime = isJpeg ? "image/jpeg" : "image/png";
    return {
      url: `data:${mime};base64,${base64Image}`,
      alt: `Illustration for: ${pageText.slice(0, 80)}`,
      engine: "kaggle-ngrok",
      contentType: mime,
    };
  }

  throw new Error("No image data found in Kaggle ngrok response");
}

/**
 * Determines which illustration engine to use based on env variables.
 * Priority:
 * 1. Explicit ILLUSTRATION_ENGINE ("stability" | "kaggle" | "bedrock")
 * 2. If STABILITY_API_KEY is configured -> "stability"
 * 3. If KAGGLE_NGROK_URL / ILLUSTRATION_API_URL is configured -> "kaggle"
 * 4. Fallback -> "bedrock"
 * @returns {"stability" | "kaggle" | "bedrock"}
 */
export function getActiveIllustrationEngine() {
  const explicitEngine = (process.env.ILLUSTRATION_ENGINE || "").trim().toLowerCase();
  if (explicitEngine === "stability") return "stability";
  if (explicitEngine === "kaggle") return "kaggle";
  if (explicitEngine === "bedrock") return "bedrock";

  if (process.env.STABILITY_API_KEY && process.env.STABILITY_API_KEY.trim()) {
    return "stability";
  }
  if (process.env.KAGGLE_NGROK_URL || process.env.ILLUSTRATION_API_URL) {
    return "kaggle";
  }
  return "bedrock";
}

/**
 * Generates an illustration using Stability AI's Direct REST API (v2beta Stable Image Core).
 * @see https://platform.stability.ai/docs/api-reference#tag/Generate/paths/~1v2beta~1stable-image~1generate~1core/post
 * @param {string} promptText
 * @param {string} pageText
 * @param {string} [negativePrompt]
 * @param {number} [seed]
 * @returns {Promise<{url: string, alt: string, engine: string, contentType: string} | null>}
 */
export async function generateStabilityIllustration(
  promptText,
  pageText = "",
  negativePrompt = DEFAULT_NEGATIVE_PROMPT,
  seed = 0
) {
  const apiKey = (process.env.STABILITY_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY is not configured in .env");
  }

  const endpoint = "https://api.stability.ai/v2beta/stable-image/generate/core";
  console.log(`[Illustrate] ⚡ Routing illustration to STABILITY AI DIRECT API: ${endpoint}`);
  console.log(`[Illustrate] 📝 Prompt: "${promptText.slice(0, 150)}${promptText.length > 150 ? "..." : ""}"`);

  const formData = new FormData();
  formData.append("prompt", promptText);
  if (negativePrompt) {
    formData.append("negative_prompt", negativePrompt);
  }
  formData.append("aspect_ratio", "1:1");
  formData.append("output_format", "jpeg");
  if (seed) {
    formData.append("seed", String(Math.abs(seed) % 4294967295));
  }

  const startTime = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: formData,
  });

  if (!response.ok) {
    const errorDetails = await response.text().catch(() => "");
    throw new Error(`Stability AI API error ${response.status} (${response.statusText}): ${errorDetails.slice(0, 300)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let base64Image = null;

  if (contentType.includes("application/json")) {
    const data = await response.json();
    base64Image = data.image || data.images?.[0];
  } else if (contentType.includes("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    base64Image = Buffer.from(arrayBuffer).toString("base64");
  }

  if (base64Image) {
    const sizeKb = Math.round((base64Image.length * 0.75) / 1024);
    console.log(`[Illustrate] ✅ STABILITY AI successfully generated illustration in ${Date.now() - startTime}ms (~${sizeKb} KB)`);
    return {
      url: `data:image/jpeg;base64,${base64Image}`,
      alt: `Illustration for: ${pageText.slice(0, 80)}`,
      engine: "stability-api",
      contentType: "image/jpeg",
    };
  }

  throw new Error("No image data found in Stability AI API response");
}

/**
 * Generates a child-friendly illustration for a story page using Stability AI (or Kaggle ngrok).
 * Returns { url, alt } on success, or null on failure (graceful degradation).
 *
 * @param {string} pageText - The story page text to illustrate
 * @param {string} theme - The story theme
 * @param {number} seed - Seed for reproducible generation
 * @param {number} retries - Retry count
 * @param {string} [scenePrompt] - Explicit visual scene description for this page
 * @param {string} [illustrationStyle] - Visual art style
 * @param {string} [explicitPrompt] - Raw explicit prompt (e.g. from req.body.prompt)
 * @returns {Promise<{url: string, alt: string} | null>}
 */
export async function generateIllustration(pageText, theme, seed, retries = 3, scenePrompt = null, illustrationStyle = "watercolor", explicitPrompt = null) {
  const isBibleIllustration =
    /\b(noah|ark|david|goliath|daniel|lion'?s den|jonah|whale|big fish|samaritan|bethlehem|jesus|moses|creation|eden|bible|scripture|rainbow promise|starry night in bethlehem|shepherd|lost sheep|red sea|ruth|naomi|joseph|coat|five thousand|calms the wind|waves)\b/i.test(
      theme + " " + pageText + " " + (scenePrompt || "")
    );

  // The primary visual subject comes directly from the page's scene description or page text
  let primaryScene =
    typeof scenePrompt === "string" && scenePrompt.trim().length > 10
      ? scenePrompt.trim()
      : extractVisualScene(pageText, theme);

  // Cap primary scene length (~25-30 words) so total prompt stays strictly within CLIP's 77 token limit
  if (primaryScene.length > 180) {
    primaryScene = primaryScene.slice(0, 180).trim().replace(/[,\s.]+$/, "");
  }

  // High-density, token-efficient style descriptors (~12-14 words / ~15 tokens each)
  const STYLE_DESCRIPTORS = {
    // Default: Claymation / Pixar-inspired cinematic style
    watercolor:
      "claymation 3D render, cute chibi proportions, soft felt clay texture, warm cinematic lighting, cozy bedtime storybook, pixar style",
    storybook:
      "children's picture book illustration, clean ink outlines, vibrant pastel colors, bright warm lighting, cheerful character, cozy storybook",
    sketch:
      "hand-drawn pencil sketch, fine crosshatch shading, warm sepia ink wash, soft storybook vignette, charming",
  };

  const styleDescriptor = isBibleIllustration
    ? "children's storybook watercolor, golden biblical lighting, serene ancient landscape, warm luminous washes, peaceful atmosphere"
    : (STYLE_DESCRIPTORS[illustrationStyle] || STYLE_DESCRIPTORS.watercolor);

  // Crucial: Keep prompt under 55-60 tokens total to guarantee CLIP never truncates.
  // Exclusions like "no text, no scary elements" belong strictly in negative_prompt.
  const illustrationPrompt = explicitPrompt || `${primaryScene}. ${styleDescriptor}.`;

  const engine = getActiveIllustrationEngine();

  // 1. Stability AI Direct REST API (v2beta Stable Image Core)
  if (engine === "stability") {
    try {
      const stabilityResult = await generateStabilityIllustration(
        illustrationPrompt,
        pageText,
        DEFAULT_NEGATIVE_PROMPT,
        seed
      );
      if (stabilityResult) return stabilityResult;
    } catch (stabErr) {
      console.error("[ImageService] Stability AI illustration failed:", stabErr.message);
    }
    console.warn(`[ImageService] Stability AI failed and engine is stability; skipping fallback to ${IMAGE_MODEL_ID}.`);
    return null;
  }

  // 2. Kaggle ngrok tunnel
  if (engine === "kaggle") {
    try {
      const kaggleResult = await generateKaggleIllustration(
        illustrationPrompt,
        pageText,
        DEFAULT_NEGATIVE_PROMPT
      );
      if (kaggleResult) return kaggleResult;
    } catch (kaggleErr) {
      console.error("[ImageService] Kaggle ngrok illustration failed:", kaggleErr.message);
    }
    console.warn(`[ImageService] Kaggle ngrok failed and engine is kaggle; skipping fallback to ${IMAGE_MODEL_ID}.`);
    return null;
  }

  // 3. AWS Bedrock
  console.log(`[Illustrate] 🎨 Routing illustration to AWS BEDROCK (${IMAGE_MODEL_ID} in ${IMAGE_REGION})`);
  console.log(`[Illustrate] 📝 Prompt: "${illustrationPrompt.slice(0, 150)}${illustrationPrompt.length > 150 ? "..." : ""}"`);

  // Stability AI Payload (e.g. Stable Image Core)
  const requestPayload = {
    prompt: illustrationPrompt,
    negative_prompt: DEFAULT_NEGATIVE_PROMPT,
    aspect_ratio: "1:1",
    seed: Math.abs(seed) % 4294967295,
    output_format: "jpeg",
  };

  const command = new InvokeModelCommand({
    modelId: IMAGE_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(requestPayload),
  });

  const bedrockStartTime = Date.now();
  try {
    const response = await bedrockImage.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const base64Image = responseBody.images?.[0];
    if (!base64Image) return null;

    const sizeKb = Math.round(base64Image.length * 0.75 / 1024);
    console.log(`[Illustrate] AWS BEDROCK successfully generated illustration in ${Date.now() - bedrockStartTime}ms (~${sizeKb} KB)`);
    return {
      url: `data:image/jpeg;base64,${base64Image}`,
      alt: `Illustration for: ${pageText.slice(0, 80)}`,
      engine: "aws-bedrock",
      contentType: "image/jpeg",
    };
  } catch (err) {
    // 1. If Bedrock rejects prompt via ValidationException (e.g. content filter on page words), retry with clean scene prompt
    if (err.name === "ValidationException" && retries > 0) {
      console.warn("Bedrock ValidationException on page prompt; retrying with clean scene prompt...", err.message);
      const safeSceneText = `${primaryScene.slice(0, 100)}, warm soft watercolor illustration, peaceful bedtime.`;
      return generateIllustration(safeSceneText, theme, seed, retries - 1);
    }

    // 2. Retry on rate limits or transient errors
    const isRetryable =
      err.name === "ThrottlingException" ||
      err.name === "ModelTimeoutException" ||
      err.name === "ServiceUnavailableException" ||
      err.$metadata?.httpStatusCode === 429 ||
      (err.$metadata?.httpStatusCode >= 500 && err.$metadata?.httpStatusCode < 600);

    if (isRetryable && retries > 0) {
      const waitMs = (4 - retries) * 1500 + Math.random() * 500;
      console.log(`Image generation retry (${err.name || "error"}) in ${waitMs}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return generateIllustration(pageText, theme, seed, retries - 1, scenePrompt);
    }
    throw err;
  }
}
