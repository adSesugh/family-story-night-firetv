import crypto from "crypto";
import { generateStoryData } from "../services/bedrockService.js";
import { saveStory } from "../db.js";
import { normalizeCategory } from "../constants/themes.js";

const ALLOWED_STORY_LENGTHS = [3, 4, 6, 8, 9];

export const generateStory = async (req, res) => {
  try {
    const {
      familyMembers = [],
      theme = "a cozy adventure",
      isCustomTheme = false,
      storyLength = 6,
      ageGuidance = "all",
      selectedChoice,
      chapter = 1,
      previousSummary,
      category: rawCategory = "adventures",
      deviceId: bodyDeviceId,
      storyId: incomingStoryId,
    } = req.body;

    const category = normalizeCategory(rawCategory);

    const deviceId =
      bodyDeviceId ||
      req.headers?.["x-device-id"] ||
      req.query?.deviceId ||
      null;

    const isBibleStory =
      category === "bible" ||
      /\b(noah|ark|david|goliath|daniel|lion'?s den|jonah|whale|big fish|samaritan|bethlehem|jesus|moses|creation|eden|bible|scripture|rainbow promise|starry night in bethlehem|shepherd|lost sheep|red sea|ruth|naomi|joseph|coat|five thousand|calms the wind|waves)\b/i.test(
        theme || ""
      );

    if (familyMembers.length === 0 && !isBibleStory) {
      return res.status(400).json({ error: "familyMembers is required" });
    }

    if (isCustomTheme && theme.length > 100) {
      return res.status(400).json({ error: "Custom theme must be 100 characters or fewer" });
    }

    const parsedLength = Number(storyLength);
    if (!ALLOWED_STORY_LENGTHS.includes(parsedLength)) {
      return res.status(400).json({ error: "storyLength must be 3, 4, 6, 8, or 9" });
    }

    const storyData = await generateStoryData({
      familyMembers,
      theme,
      isCustomTheme,
      parsedLength,
      ageGuidance,
      selectedChoice,
      chapter,
      previousSummary,
      category,
      isBibleStory
    });

    // Ensure story has a consistent UUID
    const storyId = incomingStoryId || crypto.randomUUID();
    storyData.id = storyId;

    // Immediately persist to SQLite if deviceId is provided
    if (deviceId) {
      try {
        const formattedPages = (storyData.pages || []).map((p) => {
          const text = typeof p === "object" ? p.text : p;
          const scene = typeof p === "object" ? p.scene : undefined;
          return { text, scene };
        });

        const initialChapter = {
          chapter: storyData.chapter || chapter || 1,
          pages: formattedPages,
          illustrations: [],
          lesson: storyData.lesson || "",
          choices: storyData.choices || [],
        };

        saveStory(deviceId, {
          id: storyId,
          theme,
          category,
          familyMembers,
          chapter: storyData.chapter || chapter || 1,
          lesson: storyData.lesson || "",
          choices: storyData.choices || [],
          pages: formattedPages,
          illustrations: [],
          firstPage: typeof formattedPages[0] === "string" ? formattedPages[0] : formattedPages[0]?.text || "",
          chapters: [initialChapter],
        });
        console.log(`[storyController] 💾 Saved generated story ${storyId} to SQLite for device: ${deviceId}`);
      } catch (dbErr) {
        console.warn("[storyController] Could not auto-save story to SQLite:", dbErr.message);
      }
    }

    return res.json(storyData);
  } catch (err) {
    console.error("generate-story error:", err);
    res.status(500).json({ error: "Failed to generate story" });
  }
};
