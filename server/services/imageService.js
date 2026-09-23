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
 * @param {string} theme
 * @returns {string} SVG XML string
 */
export function createBedtimeFallbackSvg(theme = "Bedtime Adventure") {
  const safeTheme = String(theme).replace(/[<>&"]/g, "").slice(0, 40);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 800" width="100%" height="100%">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a1128"/>
      <stop offset="50%" stop-color="#1c2541"/>
      <stop offset="85%" stop-color="#3a506b"/>
      <stop offset="100%" stop-color="#5c4d7d"/>
    </linearGradient>
    <radialGradient id="moonGlow" cx="75%" cy="20%" r="40%">
      <stop offset="0%" stop-color="#fff8e7" stop-opacity="1"/>
      <stop offset="25%" stop-color="#fed766" stop-opacity="0.8"/>
      <stop offset="60%" stop-color="#f4d35e" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#1c2541" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a3b5c"/>
      <stop offset="100%" stop-color="#111d33"/>
    </linearGradient>
    <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1d2d44"/>
      <stop offset="100%" stop-color="#0d1b2a"/>
    </linearGradient>
  </defs>
  <rect width="640" height="800" fill="url(#sky)"/>
  <circle cx="480" cy="180" r="140" fill="url(#moonGlow)"/>
  <circle cx="480" cy="180" r="45" fill="#fffdfa"/>
  <!-- Gentle stars -->
  <g fill="#ffeaa7" opacity="0.85">
    <circle cx="100" cy="90" r="2.5"/><circle cx="180" cy="160" r="1.5"/><circle cx="260" cy="70" r="2"/><circle cx="340" cy="130" r="2.5"/>
    <circle cx="80" cy="220" r="2"/><circle cx="210" cy="260" r="1.5"/><circle cx="580" cy="90" r="2"/><circle cx="540" cy="300" r="2"/>
    <circle cx="390" cy="240" r="2"/><circle cx="130" cy="340" r="1.8"/><circle cx="310" cy="320" r="2.2"/>
  </g>
  <!-- Distant dreamy mountains -->
  <path d="M-20,540 Q160,420 340,510 T660,470 L660,820 L-20,820 Z" fill="url(#hill1)" opacity="0.7"/>
  <path d="M-20,620 Q200,530 420,610 T660,590 L660,820 L-20,820 Z" fill="url(#hill2)"/>
  <!-- Cozy glow on horizon -->
  <ellipse cx="320" cy="780" rx="280" ry="80" fill="#e8a33d" opacity="0.18"/>
  <!-- Theme caption watermark -->
  <text x="320" y="740" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="20" fill="#fdf0d5" opacity="0.65">✦ ${safeTheme} ✦</text>
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

/**
 * Generates an illustration using a self-hosted or Kaggle ngrok endpoint.
 * @param {string} promptText
 * @param {string} pageText
 * @returns {Promise<{url: string, alt: string} | null>}
 */
export async function generateKaggleIllustration(promptText, pageText = "") {
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
    },
    body: JSON.stringify({ prompt: promptText }),
  });

  if (!response.ok) {
    throw new Error(`Kaggle ngrok error ${response.status}: ${response.statusText}`);
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
    const sizeKb = Math.round(base64Image.length * 0.75 / 1024);
    console.log(`[Illustrate] ✅ KAGGLE NGROK successfully generated illustration in ${Date.now() - startTime}ms (~${sizeKb} KB)`);
    return {
      url: `data:image/png;base64,${base64Image}`,
      alt: `Illustration for: ${pageText.slice(0, 80)}`,
      engine: "kaggle-ngrok",
    };
  }

  throw new Error("No image data found in Kaggle ngrok response");
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
  const primaryScene =
    typeof scenePrompt === "string" && scenePrompt.trim().length > 10
      ? scenePrompt.trim()
      : extractVisualScene(pageText, theme);

  const STYLE_DESCRIPTORS = {
    // Default: Claymation / Pixar-inspired cinematic style
    watercolor:
      "claymation style, stop-motion 3D render, soft felt and clay texture, chibi proportions with oversized head and rounded features, warm cinematic lighting, soft rim light, cozy purple and blue night-time color palette, dreamy storybook atmosphere, Pixar-inspired character design, highly detailed, octane render",
    storybook:
      "children's picture book illustration, bold clean ink outlines, vibrant flat colors, cheerful character design, bright warm lighting, cozy pastel bedtime palette, professional children's book art, highly detailed",
    sketch:
      "hand-drawn pencil sketch, fine crosshatch shading, warm sepia ink wash, cozy storybook feel, soft vignette, children's illustrated journal style, charming and detailed",
  };

  const styleDescriptor = isBibleIllustration
    ? "children's storybook watercolor painting, radiant golden biblical lighting, ancient Mediterranean landscape, warm luminous washes, serene reverent atmosphere, master illustrator quality"
    : (STYLE_DESCRIPTORS[illustrationStyle] || STYLE_DESCRIPTORS.watercolor);

  // Crucial: Primary visual subject and action MUST come first so the image generation model
  // focuses strictly on the exact actions, characters, and props described on this page.
  const illustrationPrompt = explicitPrompt || (
    `${primaryScene}. ` +
    `${styleDescriptor}. ` +
    `Child-safe, gentle, no text, no words, no letters, no scary elements, no violence, cozy bedtime scene.`
  );

  // 1. If KAGGLE_NGROK_URL or ILLUSTRATION_API_URL is configured, use Kaggle ngrok
  const kaggleUrl = process.env.KAGGLE_NGROK_URL || process.env.ILLUSTRATION_API_URL;
  if (kaggleUrl) {
    try {
      const kaggleResult = await generateKaggleIllustration(illustrationPrompt, pageText);
      if (kaggleResult) return kaggleResult;
    } catch (kaggleErr) {
      console.error("[ImageService] Kaggle ngrok illustration failed:", kaggleErr.message);
      if (process.env.KAGGLE_ONLY === "true") {
        return null;
      }
      console.log("[ImageService] Falling back to AWS Bedrock image generation...");
    }
  }

  console.log(`[Illustrate] 🎨 Routing illustration to AWS BEDROCK (${IMAGE_MODEL_ID} in ${IMAGE_REGION})`);
  console.log(`[Illustrate] 📝 Prompt: "${illustrationPrompt.slice(0, 150)}${illustrationPrompt.length > 150 ? "..." : ""}"`);

  // Stability AI Payload (e.g. Stable Image Core)
  const requestPayload = {
    prompt: illustrationPrompt,
    negative_prompts: "blurry, deformed, ugly, bad anatomy, extra limbs, disfigured, low quality, pixelated, watermark, text, logo, signature, realistic photo, photograph, hyperrealistic, scary, dark, horror, adult content",
    aspect_ratio: "1:1",
    seed: Math.abs(seed) % 4294967295,
    output_format: "png",
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
    console.log(`[Illustrate] ✅ AWS BEDROCK successfully generated illustration in ${Date.now() - bedrockStartTime}ms (~${sizeKb} KB)`);
    return {
      url: `data:image/png;base64,${base64Image}`,
      alt: `Illustration for: ${pageText.slice(0, 80)}`,
      engine: "aws-bedrock",
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
