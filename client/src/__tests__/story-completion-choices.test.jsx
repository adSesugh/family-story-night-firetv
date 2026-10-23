import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock swiper to avoid ESM syntax issues in Jest
jest.mock("swiper/react", () => ({
  Swiper: ({ children }) => <div data-testid="swiper-mock">{children}</div>,
  SwiperSlide: ({ children }) => <div data-testid="swiper-slide-mock">{children}</div>,
}));
jest.mock("swiper/modules", () => ({
  Keyboard: {},
  Navigation: {},
}));
jest.mock("swiper/css", () => ({}));
jest.mock("swiper/css/navigation", () => ({}));

import StoryScreen from "../components/StoryScreen";
import App from "../App";

describe("Story Completion: Lesson to Learn & Adventure Choices", () => {
  const samplePages = ["Once upon a time in the woods.", "They found a friendly firefly."];
  const sampleLesson = "Kindness lights the way even in the darkest forest.";
  const sampleChoices = [
    "Follow the firefly to the secret waterfall",
    "Build a cozy moss camp beneath the ancient oak",
  ];

  beforeEach(() => {
    localStorage.clear();
    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = jest.fn();
    window.HTMLMediaElement.prototype.load = jest.fn();
  });

  test("StoryScreen renders bedtime lesson and choice options when on conclusion slide", () => {
    const onSelectChoice = jest.fn();
    const onReturnHome = jest.fn();

    render(
      <StoryScreen
        pages={samplePages}
        pageIndex={2}
        turnKey={1}
        onTurn={jest.fn()}
        lesson={sampleLesson}
        choices={sampleChoices}
        chapter={1}
        onSelectChoice={onSelectChoice}
        onReturnHome={onReturnHome}
      />
    );

    expect(screen.getByText(/Chapter 1 Complete/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The End" })).toBeInTheDocument();
    expect(screen.getByTestId("story-lesson")).toBeInTheDocument();
    expect(screen.getByText("Lesson to Learn")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(sampleLesson, "i"))).toBeInTheDocument();
    expect(screen.getByTestId("choice-btn-0")).toBeInTheDocument();
    expect(screen.getByText(/Follow the firefly/i)).toBeInTheDocument();
    expect(screen.getByTestId("choice-btn-1")).toBeInTheDocument();
    expect(screen.getByText(/Build a cozy moss camp/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("choice-btn-0"));
    expect(onSelectChoice).toHaveBeenCalledWith(sampleChoices[0]);

    fireEvent.click(screen.getByTestId("return-home-btn"));
    expect(onReturnHome).toHaveBeenCalled();

    expect(screen.getByText(/Ch\. 1 • The End/i)).toBeInTheDocument();
  });

  test("StoryScreen displays 'Chapter 2 Lesson to Learn' when chapter is 2 or higher", () => {
    render(
      <StoryScreen
        pages={samplePages}
        pageIndex={2}
        turnKey={1}
        onTurn={jest.fn()}
        lesson={sampleLesson}
        choices={sampleChoices}
        chapter={2}
      />
    );

    expect(screen.getByText("Chapter 2 Lesson to Learn")).toBeInTheDocument();
    expect(screen.queryByText("Lesson to Learn")).not.toBeInTheDocument();
  });

  test("App flow: generating story, reaching conclusion slide, and selecting next chapter", async () => {
    const fetchMock = jest.fn((url, options) => {
      const urlStr = String(url);
      
      if (urlStr.includes("/themes")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: [] }) });
      }
      if (urlStr.includes("/voices")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ voices: [] }) });
      }
      if (urlStr.includes("/generate-story")) {
        const body = options?.body ? JSON.parse(options.body) : {};
        const isChapter2 = body.chapter === 2;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              pages: isChapter2
                ? ["Chapter two begins at the waterfall.", "They splashed with joy."]
                : ["Maya and Dad set out.", "They found a glowing path."],
              lesson: isChapter2
                ? "Adventures are best when shared together."
                : "Curiosity opens wondrous doors.",
              choices: isChapter2
                ? ["Swim with the golden fish", "Climb the rainbow rocks"]
                : ["Follow the glittering path", "Climb the tall lookout tree"],
              chapter: isChapter2 ? 2 : 1,
            }),
        });
      }
      if (urlStr.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["mock-img"], { type: "image/png" })),
        });
      }
      if (urlStr.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["mock-audio"], { type: "audio/mpeg" })),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    global.fetch = fetchMock;

    render(<App />);

    const input = screen.getByPlaceholderText(/Maya, Dad/i);
    fireEvent.change(input, { target: { value: "Maya, Dad" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin the story/i }));

    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    }, { timeout: 10000 });

    fireEvent.keyDown(window, { key: "ArrowRight", keyCode: 39 });
    fireEvent.keyDown(window, { key: "ArrowRight", keyCode: 39 });

    await waitFor(() => {
      expect(screen.getByTestId("story-conclusion")).toBeInTheDocument();
      expect(screen.getByText(/Curiosity opens wondrous doors/i)).toBeInTheDocument();
      expect(screen.getByTestId("choice-btn-0")).toBeInTheDocument();
    }, { timeout: 10000 });

    fireEvent.click(screen.getByTestId("choice-btn-0"));

    await waitFor(() => {
      const chapter2Call = fetchMock.mock.calls.find(([url, opt]) => {
        if (!String(url).includes("/generate-story") || !opt?.body) return false;
        const b = JSON.parse(opt.body);
        return b.chapter === 2;
      });
      expect(chapter2Call).toBeTruthy();
      const body = JSON.parse(chapter2Call[1].body);
      expect(body.selectedChoice).toBe("Follow the glittering path");
      expect(body.chapter).toBe(2);
    }, { timeout: 10000 });

    await waitFor(() => {
      expect(screen.getByText(/Chapter two begins at the waterfall/i)).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  test("D-pad / arrow keys navigate between choices, home button, and select on conclusion screen", async () => {
    const fetchMock = jest.fn((url, options) => {
      const urlStr = String(url);
      
      if (urlStr.includes("/themes")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: [] }) });
      }
      if (urlStr.includes("/voices")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ voices: [] }) });
      }
      if (urlStr.includes("/generate-story")) {
        const body = options?.body ? JSON.parse(options.body) : {};
        const isChapter2 = body.chapter === 2;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              pages: isChapter2
                ? ["Chapter 2 page 1.", "Chapter 2 page 2."]
                : ["Page 1 text.", "Page 2 text."],
              lesson: "Kindness is key.",
              choices: ["Option Alpha", "Option Beta"],
              chapter: isChapter2 ? 2 : 1,
            }),
        });
      }
      if (urlStr.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["mock-img"], { type: "image/png" })),
        });
      }
      if (urlStr.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["mock-audio"], { type: "audio/mpeg" })),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    global.fetch = fetchMock;

    render(<App />);

    const input = screen.getByPlaceholderText(/Maya, Dad/i);
    fireEvent.change(input, { target: { value: "Liam" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin the story/i }));

    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    }, { timeout: 10000 });

    fireEvent.keyDown(window, { key: "ArrowRight", keyCode: 39 });
    fireEvent.keyDown(window, { key: "ArrowRight", keyCode: 39 });

    await waitFor(() => {
      expect(screen.getByTestId("story-conclusion")).toBeInTheDocument();
    }, { timeout: 10000 });

    const choice0 = screen.getByTestId("choice-btn-0");
    const choice1 = screen.getByTestId("choice-btn-1");
    const homeBtn = screen.getByTestId("return-home-btn");

    expect(choice0.className).toContain("ring-4");

    fireEvent.keyDown(window, { key: "ArrowRight", keyCode: 39 });
    expect(choice1.className).toContain("ring-4");

    fireEvent.keyDown(window, { key: "ArrowLeft", keyCode: 37 });
    expect(choice0.className).toContain("ring-4");

    fireEvent.keyDown(window, { key: "ArrowDown", keyCode: 40 });
    expect(homeBtn.className).toContain("ring-2");

    fireEvent.keyDown(window, { key: "ArrowUp", keyCode: 38 });
    expect(choice0.className).toContain("ring-4");

    fireEvent.keyDown(window, { key: "ArrowRight", keyCode: 39 });
    expect(choice1.className).toContain("ring-4");

    fireEvent.keyDown(window, { key: "Enter", keyCode: 13 });

    await waitFor(() => {
      const chapter2Call = fetchMock.mock.calls.find(([url, opt]) => {
        if (!String(url).includes("/generate-story") || !opt?.body) return false;
        const b = JSON.parse(opt.body);
        return b.chapter === 2;
      });
      expect(chapter2Call).toBeTruthy();
      const body = JSON.parse(chapter2Call[1].body);
      expect(body.selectedChoice).toBe("Option Beta");
    }, { timeout: 10000 });
  }, 15000);
});
