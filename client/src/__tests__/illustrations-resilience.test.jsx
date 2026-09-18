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
import { createFallbackIllustrationUrl } from "../utils/imageUtils";

describe("Illustration Resilience & Fallback Tests", () => {
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
  });
});
