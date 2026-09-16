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
const IMAGE_REGION = process.env.BEDROCK_IMAGE_REGION || "us-west-2";

const bedrock = new BedrockRuntimeClient({ region: REGION });
const bedrockImage = new BedrockRuntimeClient({ region: IMAGE_REGION });
const polly = new PollyClient({ region: REGION });

/**
 * Generates a child-friendly illustration for a story page using Amazon Nova Canvas.
 * Returns { url, alt } on success, or null on failure (graceful degradation).
 *
 * @param {string} pageText - The story page text to illustrate
 * @param {string} theme - The story theme
 * @param {number} seed - Seed for reproducible generation (0–858,993,459)
 * @returns {Promise<{url: string, alt: string} | null>}
 */
async function generateIllustration(pageText, theme, seed, retries = 3) {
  const illustrationPrompt =
    `Children's storybook illustration, soft watercolor style, warm and cozy bedtime aesthetic. ` +
    `Scene: ${pageText.slice(0, 200)}. Theme: ${theme}. ` +
    `Gentle, safe for children, no text or words in the image, no scary elements.`;

  const command = new InvokeModelCommand({
    modelId: IMAGE_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      prompt: illustrationPrompt,
      aspect_ratio: "4:5",
      output_format: "png",
      seed: seed,
    }),
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
    if ((err.name === "ThrottlingException" || err.$metadata?.httpStatusCode === 429) && retries > 0) {
      const waitMs = (4 - retries) * 2000 + Math.random() * 1000; // 2-6 seconds
      console.log(`Rate limited, retrying in ${waitMs}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return generateIllustration(pageText, theme, seed, retries - 1);
    }
    throw err;
  }
}

const ALLOWED_VOICES = ["Joanna", "Matthew", "Emma", "Ivy"];
const ALLOWED_STORY_LENGTHS = [4, 6, 8];
const MAX_TOKENS_BY_LENGTH = { 4: 600, 6: 800, 8: 1050 };

/**
 * POST /generate-story
 * body: { familyMembers: string[], theme?: string, isCustomTheme?: boolean, storyLength?: number }
 * returns: { pages: Array<string> }
 */
app.post("/generate-story", async (req, res) => {
  try {
    const {
      familyMembers = [],
      theme = "a cozy adventure",
      isCustomTheme = false,
      storyLength = 6,
    } = req.body;

    if (familyMembers.length === 0) {
      return res.status(400).json({ error: "familyMembers is required" });
    }

    if (isCustomTheme && theme.length > 100) {
      return res.status(400).json({ error: "Custom theme must be 100 characters or fewer" });
    }

    const parsedLength = Number(storyLength);
    if (!ALLOWED_STORY_LENGTHS.includes(parsedLength)) {
      return res.status(400).json({ error: "storyLength must be 4, 6, or 8" });
    }

    console.log(`[generate-story] isCustomTheme: ${isCustomTheme}, length: ${parsedLength}, theme: "${theme}"`);

    const maxTokens = MAX_TOKENS_BY_LENGTH[parsedLength] || 800;

    const prompt = `Write a short, warm bedtime story (${parsedLength} pages, 2-3 sentences per page) \
starring these family members: ${familyMembers.join(", ")}. Theme: ${theme}. \
Make it gentle, imaginative, and suitable for all ages. \
Important rules: do not use dashes, hyphenated words, or em dashes anywhere in the story text. \
Write every sentence in plain language with standard punctuation only. \
Return ONLY a JSON array of ${parsedLength} strings, one per page, with no extra text or markdown.`;

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
    const text = responseBody.content?.[0]?.text?.trim() || "[]";

    let pages;
    try {
      pages = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      // Fallback: split into rough chunks if the model didn't return clean JSON
      pages = text.split("\n").filter(Boolean).slice(0, parsedLength);
    }

    res.json({ pages });
  } catch (err) {
    console.error("generate-story error:", err);
    res.status(500).json({ error: "Failed to generate story" });
  }
});

/**
 * POST /illustrate
 * body: { text: string, theme: string, seed?: number }
 * returns: image/png stream
 */
app.post("/illustrate", async (req, res) => {
  try {
    const { text, theme = "a cozy adventure", seed = Math.floor(Math.random() * 858993459) } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const illustration = await generateIllustration(text, theme, seed);
    if (!illustration) return res.status(500).json({ error: "Illustration generation failed" });

    // illustration.url is "data:image/png;base64,<data>" — extract and stream the bytes
    const base64Data = illustration.url.replace(/^data:image\/png;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", imageBuffer.length);
    res.end(imageBuffer);
  } catch (err) {
    console.error("illustrate error:", err);
    res.status(500).json({ error: "Failed to generate illustration" });
  }
});

/**
 * POST /narrate
 * body: { text: string, voiceId?: string }
 * returns: audio/mpeg stream
 */
app.post("/narrate", async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const selectedVoice = ALLOWED_VOICES.includes(voiceId) ? voiceId : "Joanna";

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: selectedVoice,
      Engine: "neural",
    });

    const response = await polly.send(command);
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
