import { generateIllustration, createBedtimeFallbackSvg } from "../services/imageService.js";

export const illustrate = async (req, res) => {
  const {
    text,
    theme = "a cozy adventure",
    scene,
    seed = Math.floor(Math.random() * 858993459),
    illustrationStyle = "watercolor",
    prompt,
  } = req.body;
  if (!text && !scene && !prompt) return res.status(400).json({ error: "text, scene, or prompt is required" });

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
};
