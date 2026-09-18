import express from "express";
import cors from "cors";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0";
const IMAGE_MODEL_ID = process.env.BEDROCK_IMAGE_MODEL_ID || "amazon.nova-canvas-v1:0";
const isNovaCanvas = IMAGE_MODEL_ID.includes("nova-canvas");
// Nova Canvas is supported in us-east-1; Stability is in us-west-2
const IMAGE_REGION = process.env.BEDROCK_IMAGE_REGION || (isNovaCanvas ? "us-east-1" : "us-west-2");

const bedrock = new BedrockRuntimeClient({ region: REGION });
const bedrockImage = new BedrockRuntimeClient({ region: IMAGE_REGION });
const polly = new PollyClient({ region: REGION });
const POLLY_ENGINE = process.env.POLLY_ENGINE || "standard";

/**
 * Creates a beautiful SVG watercolor bedtime scene used as an emergency fallback
 * if AI image generation is unavailable or exhausted.
 * @param {string} theme
 * @returns {string} SVG XML string
 */
function createBedtimeFallbackSvg(theme = "Bedtime Adventure") {
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
function extractVisualScene(pageText, theme) {
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
 * Generates a child-friendly illustration for a story page using Amazon Nova Canvas
 * or Stability SD 3.5 Large (auto-detected from model configuration).
 * Returns { url, alt } on success, or null on failure (graceful degradation).
 *
 * @param {string} pageText - The story page text to illustrate
 * @param {string} theme - The story theme
 * @param {number} seed - Seed for reproducible generation (0–858,993,459)
 * @param {number} retries - Retry count
 * @param {string} [scenePrompt] - Explicit visual scene description for this page
 * @returns {Promise<{url: string, alt: string} | null>}
 */
async function generateIllustration(pageText, theme, seed, retries = 3, scenePrompt = null) {
  const isBibleIllustration =
    /\b(noah|ark|david|goliath|daniel|lion'?s den|jonah|samaritan|bethlehem|jesus|moses|creation|bible|scripture|rainbow promise|starry night in bethlehem)\b/i.test(
      theme + " " + pageText + " " + (scenePrompt || "")
    );

  // The primary visual subject comes directly from the page's scene description or page text
  const primaryScene =
    typeof scenePrompt === "string" && scenePrompt.trim().length > 10
      ? scenePrompt.trim()
      : extractVisualScene(pageText, theme);

  const styleDescriptor = isBibleIllustration
    ? "Children's storybook watercolor painting, radiant golden bedtime lighting, ancient Mediterranean atmosphere, warm luminous washes, serene biblical storybook art"
    : "Children's storybook watercolor painting, soft gentle luminous washes, warm golden starlight illumination, cozy bedtime aesthetic";

  // Crucial: Primary visual subject and action MUST come first so the diffusion model
  // focuses strictly on the exact actions, characters, and props described on this page.
  const illustrationPrompt =
    `${primaryScene}. ` +
    `Style: ${styleDescriptor}. ` +
    `Bedtime storybook, gentle, safe for children, no text, no words, no letters, no scary elements.`;

  let requestPayload;
  if (isNovaCanvas) {
    requestPayload = {
      taskType: "TEXT_IMAGE",
      textToImageParams: {
        text: illustrationPrompt,
      },
      imageGenerationConfig: {
        numberOfImages: 1,
        height: 640,
        width: 512,
        cfgScale: 8.0,
        seed: Math.abs(seed) % 858993459,
      },
    };
  } else {
    // Stability SD 3.5 Large / SDXL format
    requestPayload = {
      prompt: illustrationPrompt,
      aspect_ratio: "4:5",
      output_format: "png",
      seed: Math.abs(seed) % 858993459,
    };
  }

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

const ALLOWED_VOICES = ["Joanna", "Matthew", "Emma", "Ivy"];
const ALLOWED_STORY_LENGTHS = [4, 6, 8];
// Ensure sufficient token headroom so full pages, visual scenes, unique morals, and next choices never truncate mid-JSON
const MAX_TOKENS_BY_LENGTH = { 4: 1200, 6: 1650, 8: 2100 };

/**
 * POST /generate-story
 * body: {
 *   familyMembers: string[],
 *   theme?: string,
 *   isCustomTheme?: boolean,
 *   storyLength?: number,
 *   selectedChoice?: string,
 *   chapter?: number,
 *   previousSummary?: string,
 *   category?: string
 * }
 * returns: { pages: Array<string | {text: string, scene: string}>, lesson: string, choices: Array<string>, chapter: number }
 */
app.post("/generate-story", async (req, res) => {
  try {
    const {
      familyMembers = [],
      theme = "a cozy adventure",
      isCustomTheme = false,
      storyLength = 6,
      selectedChoice,
      chapter = 1,
      previousSummary,
      category = "adventures",
    } = req.body;

    const isBibleStory =
      category === "bible" ||
      /\b(noah|ark|david|goliath|daniel|lion'?s den|jonah|whale|big fish|samaritan|bethlehem|jesus|moses|creation|eden|bible|scripture|rainbow promise|starry night in bethlehem)\b/i.test(
        theme
      );

    if (familyMembers.length === 0 && !isBibleStory) {
      return res.status(400).json({ error: "familyMembers is required" });
    }

    if (isCustomTheme && theme.length > 100) {
      return res.status(400).json({ error: "Custom theme must be 100 characters or fewer" });
    }

    const parsedLength = Number(storyLength);
    if (!ALLOWED_STORY_LENGTHS.includes(parsedLength)) {
      return res.status(400).json({ error: "storyLength must be 4, 6, or 8" });
    }

    const currentChapterNum = Number(chapter) || 1;
    const nextChapterNum = currentChapterNum + 1;

    console.log(
      `[generate-story] category: ${category}, isBible: ${isBibleStory}, isCustomTheme: ${isCustomTheme}, length: ${parsedLength}, theme: "${theme}", chapter: ${currentChapterNum}` +
      (selectedChoice ? `, choice: "${selectedChoice}"` : "")
    );

    const maxTokens = MAX_TOKENS_BY_LENGTH[parsedLength] || 1650;

    let contextClause = "";
    if (selectedChoice) {
      contextClause = ` This is Chapter ${currentChapterNum} of their ongoing journey. In the previous chapter${previousSummary ? ` (${previousSummary})` : ""}, they decided: "${selectedChoice}". Continue the story seamlessly from this choice while staying comforting and bedtime-friendly.`;
    }

    let prompt;
    if (isBibleStory) {
      const familyWeave =
        familyMembers.length > 0
          ? `Weave these family members: ${familyMembers.join(", ")} into the story with warmth, reverence, and joy as gentle helpers, companions, or witnesses who learn timeless virtues alongside the biblical figures.`
          : `Focus reverently and warmly on the biblical characters and their inspiring journey, making the timeless virtues easy for young children to understand and cherish.`;

      prompt = `Write Chapter ${currentChapterNum} of a gentle, inspiring bedtime Bible story (${parsedLength} pages, 2-3 sentences per page) \
based on: ${theme}.${contextClause} \
${familyWeave} \
Make it peaceful, comforting, and bedtime-appropriate (strictly no violence, frightening elements, or harsh conflict). \
Important rules: do not use dashes, hyphenated words, or em dashes anywhere in the story text. \
Write every sentence in plain language with standard punctuation only. \
For each page, provide: \
1. "text": The gentle story text for children (2-3 sentences). \
2. "scene": A concise 1-2 sentence visual description for the illustrator (characters, specific action, props, environment, and warm bedtime lighting on this exact page; no words or text in image). \
Include: \
- "lesson": A fresh, uplifting bedtime moral or virtue learned specifically from Chapter ${currentChapterNum}'s events (1-2 sentences). Do NOT repeat generic morals. \
- "choices": Exactly 2 brand-new, distinct and creative choices for what could happen next in Chapter ${nextChapterNum}, directly following from the conclusion of Chapter ${currentChapterNum}. \
Return ONLY a valid JSON object with this exact structure:
{
  "pages": [
    { "text": "page 1 story text", "scene": "concise visual description of page 1 scene" },
    { "text": "page 2 story text", "scene": "concise visual description of page 2 scene" }
  ],
  "lesson": "Unique moral from Chapter ${currentChapterNum}",
  "choices": ["Option 1 for Chapter ${nextChapterNum}", "Option 2 for Chapter ${nextChapterNum}"]
}`;
    } else {
      prompt = `Write Chapter ${currentChapterNum} of a warm bedtime story (${parsedLength} pages, 2-3 sentences per page) \
starring these family members: ${familyMembers.join(", ")}. Theme: ${theme}.${contextClause} \
Make it gentle, imaginative, and suitable for all ages. \
Important rules: do not use dashes, hyphenated words, or em dashes anywhere in the story text. \
Write every sentence in plain language with standard punctuation only. \
For each page, provide: \
1. "text": The gentle story text for children (2-3 sentences). \
2. "scene": A concise 1-2 sentence visual description for the illustrator (characters, specific action, props, environment, and warm bedtime lighting on this exact page; no words or text in image). \
Include: \
- "lesson": A fresh, heartwarming bedtime moral or takeaway learned specifically from Chapter ${currentChapterNum}'s events (1-2 sentences). Do NOT repeat generic morals. \
- "choices": Exactly 2 brand-new, distinct and creative choices for what could happen next in Chapter ${nextChapterNum}, directly following from the conclusion of Chapter ${currentChapterNum}. \
Return ONLY a valid JSON object with this exact structure:
{
  "pages": [
    { "text": "page 1 story text", "scene": "concise visual description of page 1 scene" },
    { "text": "page 2 story text", "scene": "concise visual description of page 2 scene" }
  ],
  "lesson": "Unique moral from Chapter ${currentChapterNum}",
  "choices": ["Option 1 for Chapter ${nextChapterNum}", "Option 2 for Chapter ${nextChapterNum}"]
}`;
    }

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content?.[0]?.text?.trim() || "{}";

    let pages = [];
    let lesson = `Every step of our bedtime journey in ${theme} brings warm memories to cherish.`;
    let choices = [
      `Explore further along the starlit path into Chapter ${nextChapterNum}`,
      `Rest by the cozy campsite and discover a quiet surprise in Chapter ${nextChapterNum}`,
    ];

    try {
      // 1. Strip markdown code fences
      let jsonStr = text.replace(/```(?:json)?([\s\S]*?)```/g, "$1").trim();

      // 2. Extract JSON substring between first { and last }
      const firstBrace = jsonStr.indexOf("{");
      const lastBrace = jsonStr.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
      }

      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        pages = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.pages)) {
          pages = parsed.pages;
        }
        if (typeof parsed.lesson === "string" && parsed.lesson.trim()) {
          lesson = parsed.lesson.trim();
        }
        if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
          choices = parsed.choices.map((c) => String(c).trim()).filter(Boolean);
        }
      }
    } catch (parseErr) {
      console.warn("[generate-story] JSON parse failed, extracting resiliently...", parseErr.message);
      // Resilient fallback 1: extract "text" fields via regex
      const textMatches = [];
      const textRegex = /"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
      let match;
      while ((match = textRegex.exec(text)) !== null) {
        try {
          textMatches.push(JSON.parse(`"${match[1]}"`));
        } catch {
          textMatches.push(match[1]);
        }
      }

      if (textMatches.length >= 2) {
        pages = textMatches.slice(0, parsedLength);
      } else {
        // Filter out raw JSON syntax tokens like ```json, {, }, "pages": etc.
        pages = text
          .split("\n")
          .map((l) => l.replace(/^[{\[\]},`"'\s]+|[{\[\]},`"'\s]+$/g, "").trim())
          .filter((l) => l.length > 25 && !/^(pages|lesson|choices|scene|text):/i.test(l))
          .slice(0, parsedLength);
      }

      // Resilient fallback 2: extract "lesson" via regex if model produced it
      const lessonMatch = text.match(/"lesson"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
      if (lessonMatch) {
        try {
          lesson = JSON.parse(`"${lessonMatch[1]}"`);
        } catch {
          lesson = lessonMatch[1];
        }
      }

      // Resilient fallback 3: extract "choices" via regex if model produced it
      const choicesMatch = text.match(/"choices"\s*:\s*\[([\s\S]*?)\]/);
      if (choicesMatch) {
        const extractedChoices = [];
        const choiceRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
        let cMatch;
        while ((cMatch = choiceRegex.exec(choicesMatch[1])) !== null) {
          try {
            extractedChoices.push(JSON.parse(`"${cMatch[1]}"`));
          } catch {
            extractedChoices.push(cMatch[1]);
          }
        }
        if (extractedChoices.length > 0) {
          choices = extractedChoices;
        }
      }
    }

    res.json({
      pages,
      lesson,
      choices,
      chapter: Number(chapter) || 1,
    });
  } catch (err) {
    console.error("generate-story error:", err);
    res.status(500).json({ error: "Failed to generate story" });
  }
});

/**
 * POST /illustrate
 * body: { text: string, theme: string, scene?: string, seed?: number }
 * returns: image/png stream
 */
app.post("/illustrate", async (req, res) => {
  const { text, theme = "a cozy adventure", scene, seed = Math.floor(Math.random() * 858993459) } = req.body;
  if (!text && !scene) return res.status(400).json({ error: "text or scene is required" });

  try {
    const illustration = await generateIllustration(text || "", theme, seed, 3, scene);
    if (illustration && illustration.url) {
      const base64Data = illustration.url.replace(/^data:image\/png;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", imageBuffer.length);
      return res.end(imageBuffer);
    }
  } catch (err) {
    console.error("illustrate error; serving graceful bedtime watercolor fallback:", err.message);
  }

  // Graceful degradation: Serve rich bedtime watercolor SVG stream so no page is ever left blank
  const svg = createBedtimeFallbackSvg(theme);
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Content-Length", Buffer.byteLength(svg));
  res.end(svg);
});

/**
 * Helper to convert an async iterable or readable stream to Buffer
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * POST /narrate
 * body: { text: string, voiceId?: string, speechMarks?: boolean }
 * returns: audio/mpeg stream OR { audio: string, speechMarks: Array<{ time, start, end, value }> }
 */
app.post("/narrate", async (req, res) => {
  try {
    const { text, voiceId, speechMarks } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const selectedVoice = ALLOWED_VOICES.includes(voiceId) ? voiceId : "Joanna";

    const audioCommand = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: selectedVoice,
      Engine: POLLY_ENGINE,
    });

    if (speechMarks) {
      // Concurrently synthesize audio and word-level speech marks
      const marksCommand = new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: "json",
        SpeechMarkTypes: ["word"],
        VoiceId: selectedVoice,
        Engine: POLLY_ENGINE,
      });

      const [audioRes, marksRes] = await Promise.all([
        polly.send(audioCommand),
        polly.send(marksCommand).catch((err) => {
          console.warn("Failed to fetch Polly speech marks:", err?.message || err);
          return null;
        }),
      ]);

      const audioBuffer = await streamToBuffer(audioRes.AudioStream);

      let parsedMarks = [];
      if (marksRes && marksRes.AudioStream) {
        try {
          const marksBuffer = await streamToBuffer(marksRes.AudioStream);
          parsedMarks = marksBuffer
            .toString("utf-8")
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => JSON.parse(l))
            .filter((m) => m.type === "word");
        } catch (mErr) {
          console.warn("Error parsing speech marks lines:", mErr);
        }
      }

      return res.json({
        audio: `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`,
        speechMarks: parsedMarks,
      });
    }

    // Default: stream raw audio/mpeg for backward compatibility
    const response = await polly.send(audioCommand);
    res.setHeader("Content-Type", "audio/mpeg");

    const stream = response.AudioStream;
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error("narrate error:", err);
    res.status(500).json({ error: "Failed to narrate text" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Family Story Night server running on port ${PORT}`));
