import { generateIllustration, createBedtimeFallbackSvg } from "../services/imageService.js";
import { saveStoryIllustration, getStoryIllustration } from "../db.js";

export const illustrate = async (req, res) => {
  const {
    text,
    theme = "a cozy adventure",
    scene,
    seed = Math.floor(Math.random() * 858993459),
    illustrationStyle = "watercolor",
    prompt,
    storyId,
    pageIndex,
    chapter = 1,
  } = req.body;
  if (!text && !scene && !prompt) return res.status(400).json({ error: "text, scene, or prompt is required" });

  const chapterNum = Number(chapter) || 1;

  // 1. Check SQLite Cache if storyId and pageIndex are provided
  if (storyId && pageIndex !== undefined && pageIndex !== null) {
    try {
      const cachedUrl = getStoryIllustration(storyId, Number(pageIndex), chapterNum);
      if (cachedUrl && typeof cachedUrl === "string" && !cachedUrl.startsWith("data:image/svg+xml")) {
        console.log(`[Illustrate] ⚡ SQLite Cache HIT: Story=${storyId} Chapter=${chapterNum} Page=${pageIndex}`);
        const isJpeg = cachedUrl.startsWith("data:image/jpeg");
        const mime = isJpeg ? "image/jpeg" : "image/png";
        const base64Data = cachedUrl.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        res.setHeader("Content-Type", mime);
        res.setHeader("Content-Length", imageBuffer.length);
        res.setHeader("X-Illustration-Cached", "true");
        return res.end(imageBuffer);
      }
    } catch (cacheErr) {
      console.warn("[Illustrate] Cache check error:", cacheErr.message);
    }
  }

  try {
    const illustration = await generateIllustration(
      text || prompt || "",
      theme,
      seed,
      3,
      scene,
      illustrationStyle,
      prompt
    );
    if (illustration && illustration.url) {
      // 2. Persist newly generated illustration directly into SQLite
      if (storyId && pageIndex !== undefined && pageIndex !== null) {
        try {
          saveStoryIllustration(storyId, Number(pageIndex), illustration.url, `Illustration for page ${Number(pageIndex) + 1}`, chapterNum);
          console.log(`[Illustrate] 💾 Stored illustration in SQLite for story: ${storyId} (Chapter: ${chapterNum}, Page: ${pageIndex})`);
        } catch (dbErr) {
          console.warn("[Illustrate] Could not save illustration to DB:", dbErr.message);
        }
      }

      const isJpeg = illustration.url.startsWith("data:image/jpeg") || illustration.contentType === "image/jpeg";
      const mime = isJpeg ? "image/jpeg" : "image/png";
      const base64Data = illustration.url.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");

      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Length", imageBuffer.length);
      res.setHeader("X-Illustration-Engine", illustration.engine || "aws-bedrock");
      return res.end(imageBuffer);
    }
  } catch (err) {
    console.error("illustrate error; serving graceful bedtime watercolor fallback:", err.message);
  }

  // Graceful degradation: Serve rich bedtime watercolor SVG stream so no page is ever left blank
  const svg = createBedtimeFallbackSvg(theme, chapterNum, Number(pageIndex) + 1);
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Content-Length", Buffer.byteLength(svg));
  res.end(svg);
};
