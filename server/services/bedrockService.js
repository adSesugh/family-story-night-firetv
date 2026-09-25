import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { CANONICAL_BIBLE_STORIES } from "../constants/themes.js";
import dotenv from "dotenv";

dotenv.config();

const REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
const bedrock = new BedrockRuntimeClient({ region: REGION });

const MAX_TOKENS_BY_LENGTH = { 3: 1000, 4: 1200, 6: 1650, 8: 2100, 9: 2400 };

export async function generateStoryData({
  familyMembers,
  theme,
  isCustomTheme,
  parsedLength,
  ageGuidance = "all",
  selectedChoice,
  chapter,
  previousSummary,
  category,
  isBibleStory
}) {
  const currentChapterNum = Number(chapter) || 1;
  const nextChapterNum = currentChapterNum + 1;

  let effectiveTheme = theme;
  if (isBibleStory && (!effectiveTheme || effectiveTheme === "random" || effectiveTheme.trim() === "")) {
    effectiveTheme = CANONICAL_BIBLE_STORIES[Math.floor(Math.random() * CANONICAL_BIBLE_STORIES.length)].title;
  }

  const matchedCanonical = isBibleStory
    ? CANONICAL_BIBLE_STORIES.find(
      (s) =>
        s.title.toLowerCase() === (effectiveTheme || "").toLowerCase() ||
        (effectiveTheme || "").toLowerCase().includes(s.title.toLowerCase()) ||
        s.title.toLowerCase().includes((effectiveTheme || "").toLowerCase())
    )
    : null;

  console.log(
    `[generate-story] category: ${category}, isBible: ${isBibleStory}, isCustomTheme: ${isCustomTheme}, length: ${parsedLength}, ageGuidance: ${ageGuidance}, theme: "${effectiveTheme}", chapter: ${currentChapterNum}` +
    (selectedChoice ? `, choice: "${selectedChoice}"` : "")
  );

  const maxTokens = MAX_TOKENS_BY_LENGTH[parsedLength] || (parsedLength * 280);

  let contextClause = "";
  if (selectedChoice) {
    contextClause = ` This is Chapter ${currentChapterNum} of their ongoing journey. In the previous chapter${previousSummary ? ` (${previousSummary})` : ""}, they decided: "${selectedChoice}". Continue the story seamlessly from this choice while staying comforting and bedtime-friendly.`;
  }

  let ageGuidanceInstruction = "Age Guidance: Suitable for all ages with gentle, comforting, bedtime-appropriate language.";
  if (ageGuidance === "3+" || parsedLength === 3) {
    ageGuidanceInstruction = "Age Guidance: Preschool & Toddlers (Ages 2–4). Use very simple, warm words, short and soothing sentences (1–2 sentences per page), gentle repetition, comforting concepts (soft blanket, twinkling star, friendly animal, smiling moon), and zero conflict or tension.";
  } else if (ageGuidance === "5+" || parsedLength === 6) {
    ageGuidanceInstruction = "Age Guidance: Early Readers (Ages 5–7). Use playful, engaging storybook language (2–3 sentences per page), relatable childhood curiosity, gentle wonder, and heartwarming themes.";
  } else if (ageGuidance === "8+" || parsedLength === 9) {
    ageGuidanceInstruction = "Age Guidance: Independent Readers (Ages 8+). Use richer, more descriptive vocabulary (3–4 sentences per page), thoughtful adventure details, creative problem-solving, and inspiring reflections.";
  }

  let prompt;
  if (isBibleStory) {
    const familyWeave =
      familyMembers.length > 0
        ? `Weave these family members: ${familyMembers.join(", ")} into the story with warmth, reverence, and joy as gentle helpers, companions, or witnesses who learn timeless virtues alongside the biblical figures.`
        : `Focus reverently and warmly on the biblical characters and their inspiring journey, making the timeless virtues easy for young children to understand and cherish.`;

    const scriptureGrounding = matchedCanonical
      ? `Canonical Scripture passage: ${matchedCanonical.reference}. Virtue focus: ${matchedCanonical.virtue}. Ground the narrative strictly in authentic biblical Scripture—do not invent fictional events or false doctrines.`
      : `Ground the narrative faithfully in authentic biblical Scripture—do not invent fictional theological doctrines or false events.`;

    prompt = `Write Chapter ${currentChapterNum} of a gentle, inspiring bedtime Bible story (${parsedLength} pages, 2-3 sentences per page) \
based on: ${effectiveTheme}.${contextClause} \
${scriptureGrounding} \
${familyWeave} \
${ageGuidanceInstruction} \
Make it peaceful, comforting, and bedtime-appropriate (strictly no violence, frightening elements, or harsh conflict). \
Important rules: do not use dashes, hyphenated words, or em dashes anywhere in the story text. \
Write every sentence in plain language with standard punctuation only. \
For each page, provide: \
1. "text": The gentle story text for children (2-3 sentences). \
2. "scene": A concise 1-2 sentence visual description for the illustrator (characters, specific action, props, environment, and warm bedtime lighting on this exact page; no words or text in image). \
Include: \
- "lesson": A fresh, uplifting bedtime moral or virtue learned specifically from Chapter ${currentChapterNum}'s events (1-2 sentences). Do NOT repeat generic morals. \
- "choices": Exactly 2 distinct and creative choices for what happens next in Chapter ${nextChapterNum} (keep each choice to 1 concise, descriptive sentence of 8-12 words, easy to read on screen). \
CRITICAL REQUIREMENT: The "pages" array in your JSON output MUST contain EXACTLY ${parsedLength} items (one object per page for pages 1 through ${parsedLength}). Do not return fewer or more than ${parsedLength} pages. \
Return ONLY a valid JSON object with this exact structure:
{
  "pages": [
    { "text": "page 1 story text", "scene": "concise visual description of page 1 scene" }
  ],
  "lesson": "Unique moral from Chapter ${currentChapterNum}",
  "choices": ["Follow the gentle dove towards the peaceful olive grove", "Rest beside the quiet brook and count the evening stars"]
}`;
  } else {
    let toneInstruction = "Make it gentle, imaginative, and suitable for all ages.";
    if (category === "fables") {
      toneInstruction = "Make it rich in timeless folk wisdom, gentle humor, and heartwarming moral growth suitable for bedtime.";
    } else if (category === "nature") {
      toneInstruction = "Make it peaceful, grounded in nature and gentle animal life, with soothing sensory descriptions of the natural world settling down for sleep.";
    } else if (category === "science") {
      toneInstruction = "Make it filled with gentle wonder, curiosity about our world and universe, and inspiring discovery without bedtime overstimulation.";
    } else if (category === "calm") {
      toneInstruction = "Make it ultra-calming, slow-paced, cozy, sensory, and deeply soothing, specifically crafted to help children relax and fall peacefully asleep.";
    }

    prompt = `Write Chapter ${currentChapterNum} of a warm bedtime story (${parsedLength} pages, 2-3 sentences per page) \
starring these family members: ${familyMembers.join(", ")}. Theme: ${theme}.${contextClause} \
${toneInstruction} \
${ageGuidanceInstruction} \
Important rules: do not use dashes, hyphenated words, or em dashes anywhere in the story text. \
Write every sentence in plain language with standard punctuation only. \
For each page, provide: \
1. "text": The gentle story text for children (2-3 sentences). \
2. "scene": A concise 1-2 sentence visual description for the illustrator (characters, specific action, props, environment, and warm bedtime lighting on this exact page; no words or text in image). \
Include: \
- "lesson": A fresh, heartwarming bedtime moral or takeaway learned specifically from Chapter ${currentChapterNum}'s events (1-2 sentences). Do NOT repeat generic morals. \
- "choices": Exactly 2 distinct and creative choices for what happens next in Chapter ${nextChapterNum} (keep each choice to 1 concise, descriptive sentence of 8-12 words, easy to read on screen). \
CRITICAL REQUIREMENT: The "pages" array in your JSON output MUST contain EXACTLY ${parsedLength} items (one object per page for pages 1 through ${parsedLength}). Do not return fewer or more than ${parsedLength} pages. \
Return ONLY a valid JSON object with this exact structure:
{
  "pages": [
    { "text": "page 1 story text", "scene": "concise visual description of page 1 scene" }
  ],
  "lesson": "Unique moral from Chapter ${currentChapterNum}",
  "choices": ["Follow the glowing fireflies deeper into the whispering forest", "Build a cozy starlight shelter beside the peaceful stream"]
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
    `Follow the starlit path deeper into the quiet woods`,
    `Build a cozy campfire and watch the shooting stars`,
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
        choices = parsed.choices
          .map((c) => String(c).trim().replace(/^(?:Option|Choice)\s*\d+[:\-.]\s*/i, ""))
          .filter(Boolean);
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

  if (Array.isArray(pages) && pages.length > parsedLength) {
    pages = pages.slice(0, parsedLength);
  }

  return {
    pages,
    lesson,
    choices,
    chapter: Number(chapter) || 1,
    scriptureReference: matchedCanonical ? matchedCanonical.reference : null,
    virtue: matchedCanonical ? matchedCanonical.virtue : null,
  };
}
