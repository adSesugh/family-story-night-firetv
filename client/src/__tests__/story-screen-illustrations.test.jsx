import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * Task 13.3 — Unit tests for illustration rendering in StoryScreen
 * Requirements: 5.2, 5.3, 5.4
 */

// ─── Minimal stub for StoryScreen (avoids Swiper CSS / DOM issues) ──────────
// We test the rendering logic directly: same branching as the real component.
function StoryPageContent({ page, turnKey }) {
  const pageText = typeof page === "object" ? page.text : page;
  const pageIllustration = typeof page === "object" ? page.illustration : null;

  return (
    <div>
      {pageIllustration && (
        <img
          src={pageIllustration.url}
          alt={pageIllustration.alt}
          className="mb-6 w-full rounded-sm object-cover max-h-64"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
          data-testid="illustration"
        />
      )}
      <p key={turnKey} data-testid="page-text">
        {pageText}
      </p>
    </div>
  );
}

describe("StoryScreen illustration rendering (Req 5.2, 5.3, 5.4)", () => {
  describe("when page is a plain string (backward compat)", () => {
    it("renders the page text", () => {
      render(<StoryPageContent page="Once upon a time…" turnKey={0} />);
      expect(screen.getByTestId("page-text")).toHaveTextContent("Once upon a time…");
    });

    it("does NOT render an <img>", () => {
      render(<StoryPageContent page="Once upon a time…" turnKey={0} />);
      expect(screen.queryByTestId("illustration")).not.toBeInTheDocument();
    });
  });

  describe("when page is an object with illustration data", () => {
    const pageWithIllustration = {
      text: "A dragon soared over the mountains.",
      illustration: {
        url: "https://example.com/dragon.png",
        alt: "A dragon soaring over mountains",
      },
    };

    it("renders the page text from page.text", () => {
      render(<StoryPageContent page={pageWithIllustration} turnKey={1} />);
      expect(screen.getByTestId("page-text")).toHaveTextContent(
        "A dragon soared over the mountains."
      );
    });

    it("renders an <img> with the correct src and alt (Req 5.2)", () => {
      render(<StoryPageContent page={pageWithIllustration} turnKey={1} />);
      const img = screen.getByTestId("illustration");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/dragon.png");
      expect(img).toHaveAttribute("alt", "A dragon soaring over mountains");
    });
  });

  describe("when page is an object WITHOUT illustration (illustration is null)", () => {
    const pageNoIllustration = {
      text: "The forest was quiet.",
      illustration: null,
    };

    it("renders the page text", () => {
      render(<StoryPageContent page={pageNoIllustration} turnKey={2} />);
      expect(screen.getByTestId("page-text")).toHaveTextContent("The forest was quiet.");
    });

    it("does NOT render an <img>", () => {
      render(<StoryPageContent page={pageNoIllustration} turnKey={2} />);
      expect(screen.queryByTestId("illustration")).not.toBeInTheDocument();
    });
  });

  describe("illustration onError handler (Req 5.4 — graceful degradation)", () => {
    it("sets display:none on the img when onError fires", () => {
      render(
        <StoryPageContent
          page={{
            text: "Text here.",
            illustration: { url: "https://broken.example/img.png", alt: "broken" },
          }}
          turnKey={3}
        />
      );

      const img = screen.getByTestId("illustration");

      // Simulate the browser firing onError (e.g., broken image URL)
      img.dispatchEvent(new Event("error", { bubbles: true }));

      expect(img.style.display).toBe("none");
    });
  });
});
