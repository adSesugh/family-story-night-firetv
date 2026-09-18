import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import StoryScreen from "../components/StoryScreen";
import AmbientParticles from "../components/AmbientParticles";

// Mock Swiper to render slides directly in DOM for Testing Library
jest.mock("swiper/react", () => ({
  Swiper: ({ children }) => <div data-testid="swiper-mock">{children}</div>,
  SwiperSlide: ({ children }) => <div data-testid="swiper-slide">{children}</div>,
}));
jest.mock("swiper/modules", () => ({
  Navigation: jest.fn(),
}));

describe("Karaōke Read-Along and Bedtime Wind-Down Mode", () => {
  const mockPages = [
    { text: "The brave little squirrel climbed the giant oak tree." },
    { text: "At the top, stars glittered like golden fireflies." },
  ];

  it("renders standard text without karaoke word highlight when activeSpeechMark is null", () => {
    render(
      <StoryScreen
        pages={mockPages}
        pageIndex={0}
        turnKey={0}
        onTurn={jest.fn()}
        activeSpeechMark={null}
        windDown={false}
      />
    );

    const pageTexts = screen.getAllByTestId("page-text");
    expect(pageTexts[0]).toHaveTextContent("The brave little squirrel climbed the giant oak tree.");
    expect(screen.queryByTestId("karaoke-word")).not.toBeInTheDocument();
  });

  it("illuminates the active word in the current page when activeSpeechMark is provided", () => {
    // "squirrel" in "The brave little squirrel climbed the giant oak tree."
    // "The brave little " is length 17
    // "squirrel" is start: 17, end: 25
    const speechMark = {
      time: 1200,
      type: "word",
      start: 17,
      end: 25,
      value: "squirrel",
    };

    render(
      <StoryScreen
        pages={mockPages}
        pageIndex={0}
        turnKey={0}
        onTurn={jest.fn()}
        activeSpeechMark={speechMark}
        windDown={false}
      />
    );

    const karaokeWord = screen.getByTestId("karaoke-word");
    expect(karaokeWord).toBeInTheDocument();
    expect(karaokeWord).toHaveTextContent("squirrel");
  });

  it("renders Bedtime Wind-Down badge and calmer text styling when windDown is true", () => {
    render(
      <StoryScreen
        pages={mockPages}
        pageIndex={0}
        turnKey={0}
        onTurn={jest.fn()}
        activeSpeechMark={null}
        windDown={true}
      />
    );

    const badge = screen.getByTestId("wind-down-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Bedtime Wind-Down");
  });

  it("does not render Bedtime Wind-Down badge when windDown is false", () => {
    render(
      <StoryScreen
        pages={mockPages}
        pageIndex={0}
        turnKey={0}
        onTurn={jest.fn()}
        activeSpeechMark={null}
        windDown={false}
      />
    );

    expect(screen.queryByTestId("wind-down-badge")).not.toBeInTheDocument();
  });

  it("renders bedtime-dimmer-veil when windDown is true", () => {
    render(
      <StoryScreen
        pages={mockPages}
        pageIndex={0}
        turnKey={0}
        onTurn={jest.fn()}
        activeSpeechMark={null}
        windDown={true}
      />
    );

    expect(screen.getByTestId("bedtime-dimmer-veil")).toBeInTheDocument();
  });

  it("AmbientParticles renders warm candlelight particles in windDown mode", () => {
    const { container } = render(<AmbientParticles count={6} windDown={true} />);
    const particles = container.querySelectorAll(".rounded-full");
    expect(particles.length).toBe(6);
  });
});

