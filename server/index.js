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

const bedrock = new BedrockRuntimeClient({ region: REGION });
const polly = new PollyClient({ region: REGION });

/**
 * POST /generate-story
 * body: { familyMembers: string[], theme: string }
 * returns: { pages: string[] }
 */
app.post("/generate-story", async (req, res) => {
  try {
    const { familyMembers = [], theme = "a cozy adventure" } = req.body;

    if (familyMembers.length === 0) {
      return res.status(400).json({ error: "familyMembers is required" });
    }

    const prompt = `Write a short, warm bedtime story (6 pages, 2-3 sentences per page) \
starring these family members: ${familyMembers.join(", ")}. Theme: ${theme}. \
Make it gentle, imaginative, and suitable for all ages. \
Important rules: do not use dashes, hyphenated words, or em dashes anywhere in the story text. \
Write every sentence in plain language with standard punctuation only. \
Return ONLY a JSON array of 6 strings, one per page, with no extra text or markdown.`;

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 800,
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
      pages = text.split("\n").filter(Boolean).slice(0, 6);
    }

    res.json({ pages });
  } catch (err) {
    console.error("generate-story error:", err);
    res.status(500).json({ error: "Failed to generate story" });
  }
});

/**
 * POST /narrate
 * body: { text: string }
 * returns: audio/mpeg stream
 */
app.post("/narrate", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: "Joanna",
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
