import React from "react";
import { render, screen } from "@testing-library/react";

// Mock swiper to avoid ESM syntax issues in Jest
jest.mock("swiper/react", () => ({
  Swiper: ({ children }) => <div data-testid="swiper-mock">{children}</div>,
  SwiperSlide: ({ children }) => <div data-testid="swiper-slide-mock">{children}</div>,
}));
jest.mock("swiper/modules", () => ({
  Navigation: jest.fn(),
}));
jest.mock("swiper/css", () => ({}));
jest.mock("swiper/css/navigation", () => ({}));

import StoryScreen from "../components/StoryScreen";

describe("StoryScreen Text Overflow & Top Paragraph Visibility", () => {
  const longStoryPage =
    "Once upon a bedtime in a sleepy little woodland cottage, Maya and Leo sat by the hearth while their grandfather opened an ancient, leather-bound storybook. " +
    "The first tale began with a whisper of silver stardust falling upon the ancient mossy oaks. Every page was filled with winding adventures through shimmering caverns, " +
    "gentle glowing fireflies, whispering riverbanks, and sweet lullabies sung by the owls in the treetops. As the evening deepened, the embers crackled softly, " +
    "casting golden shadows across the room, reminding everyone that home is where warmth and stories live forever.";

  it("renders page text with my-auto and overflow-y-auto so the starting paragraph top is never cut off", () => {
    const { container } = render(
      <StoryScreen
        pages={[longStoryPage]}
        illustrations={[]}
        pageIndex={0}
        turnKey={0}
        onTurn={jest.fn()}
      />
    );

    const pageTextEl = screen.getByTestId("page-text");
    expect(pageTextEl).toBeInTheDocument();
    expect(pageTextEl.textContent).toContain("Once upon a bedtime in a sleepy little woodland cottage");

    // Must have my-auto so it centers when short, but starts at top (collapsing margins) when overflowing
    expect(pageTextEl.className).toContain("my-auto");

    // The scrollable container must have overflow-y-auto and flex-col
    const scrollContainer = container.querySelector(".story-page-scroll");
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer.className).toContain("overflow-y-auto");
    expect(scrollContainer.className).toContain("flex-col");
  });
});
