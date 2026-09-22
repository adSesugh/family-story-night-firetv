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
 * Generates a child-friendly illustration for a story page using Stability AI.
 * Returns { url, alt } on success, or null on failure (graceful degradation).
 *
 * @param {string} pageText - The story page text to illustrate
 * @param {string} theme - The story theme
 * @param {number} seed - Seed for reproducible generation
 * @param {number} retries - Retry count
 * @param {string} [scenePrompt] - Explicit visual scene description for this page
 * @returns {Promise<{url: string, alt: string} | null>}
 */
export async function generateIllustration(pageText, theme, seed, retries = 3, scenePrompt = null, illustrationStyle = "watercolor") {
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
    storybook:
      "Children's picture book illustration, bold ink outlines, vibrant flat colors, clean graphic style, bright warm lighting, cozy bedtime palette",
    sketch:
      "Pencil sketch illustration with light watercolor washes, hand-drawn cozy feel, soft warm tones, gentle bedtime aesthetic",
    watercolor:
      "Children's storybook watercolor painting, soft gentle luminous washes, warm golden starlight illumination, cozy bedtime aesthetic",
  };

  const styleDescriptor = isBibleIllustration
    ? "Children's storybook watercolor painting, radiant golden bedtime lighting, ancient Mediterranean atmosphere, warm luminous washes, serene biblical storybook art"
    : (STYLE_DESCRIPTORS[illustrationStyle] || STYLE_DESCRIPTORS.watercolor);

  // Crucial: Primary visual subject and action MUST come first so the image generation model
  // focuses strictly on the exact actions, characters, and props described on this page.
  const illustrationPrompt =
    `${primaryScene}. ` +
    `Style: ${styleDescriptor}. ` +
    `Bedtime storybook, gentle, safe for children, no text, no words, no letters, no scary elements.`;

  // Stability AI Payload (e.g. Stable Image Core)
  const requestPayload = {
    prompt: illustrationPrompt,
    aspect_ratio: "1:1", // 1:1 perfectly maps to 512x512 downscaling
    seed: Math.abs(seed) % 4294967295,
    output_format: "png",
  };

  const command = new InvokeModelCommand({
    modelId: IMAGE_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(requestPayload),
  });

  try {
    const response = await bedrockImage.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const base64Image = responseBody.images?.[0];
    if (!base64Image) return null;
    return {
      url: `data:image/png;base64,${base64Image}`,
      alt: `Illustration for: ${pageText.slice(0, 80)}`,
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
