import { generateStoryData } from "../services/bedrockService.js";

const ALLOWED_STORY_LENGTHS = [4, 6, 8];

export const generateStory = async (req, res) => {
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
      return res.status(400).json({ error: "storyLength must be 4, 6, or 8" });
    }

    const storyData = await generateStoryData({
      familyMembers,
      theme,
      isCustomTheme,
      parsedLength,
      selectedChoice,
      chapter,
      previousSummary,
      category,
      isBibleStory
    });

    return res.json(storyData);
  } catch (err) {
    console.error("generate-story error:", err);
    res.status(500).json({ error: "Failed to generate story" });
  }
};
