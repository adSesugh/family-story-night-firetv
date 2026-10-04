import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Swiper to avoid ESM issues in Jest
jest.mock("swiper/react", () => ({
  Swiper: ({ children }) => <div data-testid="swiper-mock">{children}</div>,
  SwiperSlide: ({ children }) => <div data-testid="swiper-slide-mock">{children}</div>,
}));
jest.mock("swiper/modules", () => ({
  Navigation: {},
}));
jest.mock("swiper/css", () => ({}));
jest.mock("swiper/css/navigation", () => ({}));

import StoryScreen from "../components/StoryScreen";
import { createFallbackIllustrationUrl, compressBlobToDataUrl } from "../utils/imageUtils";

describe("Illustration Resilience & Fallback Tests", () => {
  describe("compressBlobToDataUrl vector preservation", () => {
    it("preserves SVG vector blobs directly without downscaling to a raster JPEG", async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1280"><rect width="1024" height="1280" fill="#05161b"/></svg>';
      const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });

      const result = await compressBlobToDataUrl(svgBlob);
      expect(result).toMatch(/^data:image\/svg\+xml;/);
      expect(result).not.toMatch(/^data:image\/jpeg/);
    });
  });

  describe("createFallbackIllustrationUrl", () => {
    it("generates a valid SVG data URL containing the active theme and page number", () => {
      const url = createFallbackIllustrationUrl("starlight forest", 3);
      expect(url).toMatch(/^data:image\/svg\+xml;utf8,/);
      expect(url).toContain("starlight%20forest");
      expect(url).toContain("PAGE%203");
    });

    it("sanitizes special characters in theme names gracefully", () => {
      const url = createFallbackIllustrationUrl("<script>alert('x')</script>", 1);
      expect(url).not.toContain("<script>");
      expect(url).toMatch(/^data:image\/svg\+xml;utf8,/);
    });

    it("generates distinct crisp color harmonies and watermark for chapter 2 and chapter 3", () => {
      const ch1Url = createFallbackIllustrationUrl("cozy castle", 1, 1);
      const ch2Url = createFallbackIllustrationUrl("cozy castle", 1, 2);
      const ch3Url = createFallbackIllustrationUrl("cozy castle", 1, 3);

      expect(ch1Url).toContain("PAGE%201");
      expect(ch2Url).toContain("Chapter%202");
      expect(ch3Url).toContain("Chapter%203");

      // Verify explicit high-DPI 1024x1280 resolution attributes
      expect(decodeURIComponent(ch2Url)).toContain('width="1024" height="1280"');
      expect(decodeURIComponent(ch2Url)).toContain('viewBox="0 0 1024 1280"');

      // Verify Chapter 2 uses aurora teal palette (#05161b, #6ee7b7, #34d399)
      expect(decodeURIComponent(ch2Url)).toContain("#05161b");
      expect(decodeURIComponent(ch2Url)).toContain("#34d399");

      // Verify Chapter 3 uses celestial rose/amethyst palette (#120921, #fb7185)
      expect(decodeURIComponent(ch3Url)).toContain("#120921");
      expect(decodeURIComponent(ch3Url)).toContain("#fb7185");
    });
  });

  describe("StoryScreen placeholder rendering", () => {
    it("renders living canvas shimmer placeholder when an illustration is still generating", () => {
      const samplePages = ["Page one text", "Page two text"];
      // Page 0 has an illustration; Page 1 is still generating
      const illustrations = ["data:image/png;base64,sample-img-0", null];

      render(
        <StoryScreen
          pages={samplePages}
          illustrations={illustrations}
          pageIndex={1}
          onTurn={jest.fn()}
        />
      );

      // The placeholder should show "Bringing scene to life..." and "Painting Page 2"
      expect(screen.getByText(/Bringing scene to life/i)).toBeInTheDocument();
      expect(screen.getByText(/Painting Page 2/i)).toBeInTheDocument();
    });

    it("renders the <img> once the illustration arrives", () => {
      const samplePages = ["Page one text"];
      const illustrations = ["data:image/png;base64,sample-img-0"];

      render(
        <StoryScreen
          pages={samplePages}
          illustrations={illustrations}
          pageIndex={0}
          onTurn={jest.fn()}
        />
      );

      const img = screen.getByAltText("Illustration for page 1");
      expect(img).toBeInTheDocument();
      expect(img.getAttribute("src")).toBe("data:image/png;base64,sample-img-0");
    });

    it("does not render a blurry backdrop for SVG fallback illustrations", () => {
      const samplePages = ["Page one text"];
      const svgFallback = createFallbackIllustrationUrl("Bedtime Adventure", 1, 2);
      const illustrations = [svgFallback];

      render(
        <StoryScreen
          pages={samplePages}
          illustrations={illustrations}
          pageIndex={0}
          onTurn={jest.fn()}
        />
      );

      // Main image should be present
      const mainImg = screen.getByAltText("Illustration for page 1");
      expect(mainImg).toBeInTheDocument();
      expect(mainImg.getAttribute("src")).toBe(svgFallback);

      // Blur backdrop with aria-hidden="true" should NOT exist for SVGs
      const hiddenImages = document.querySelectorAll('img[aria-hidden="true"]');
      expect(hiddenImages.length).toBe(0);
    });
  });
});
