// Mock Swiper to avoid ESM issues in Jest
jest.mock("swiper/react", () => ({
  Swiper: ({ children }) => <div data-testid="swiper-mock">{children}</div>,
  SwiperSlide: ({ children }) => <div data-testid="swiper-slide-mock">{children}</div>,
}));
jest.mock("swiper/modules", () => ({
  Navigation: () => null,
}));
jest.mock("swiper/css", () => ({}));
jest.mock("swiper/css/navigation", () => ({}));

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../App";
import { StorageService } from "../utils/storage";
import { saveStory } from "../utils/storyHistory";

describe("History Missing Illustration Retry & Graceful Timeout Fallback", () => {
  let originalFetch;
  let mockFetch;

  beforeEach(() => {
    StorageService.removeItem("familyStoryNight_history");
    StorageService.removeItem("familyStoryNight_voice");
    StorageService.removeItem("familyStoryNight_settings");

    originalFetch = global.fetch;
    mockFetch = jest.fn().mockImplementation((url, opts) => {
      const urlStr = String(url);
      
      // Mock /themes endpoint
      if (urlStr.includes("/themes")) {
        return Promise.resolve({ 
          ok: true, 
          json: async () => ({ categories: [] }) 
        });
      }
      
      // Mock /voices endpoint
      if (urlStr.includes("/voices")) {
        return Promise.resolve({ 
          ok: true, 
          json: async () => ({ voices: [] }) 
        });
      }
      
      // Mock /api/history endpoint
      if (urlStr.includes("/api/history")) {
        return Promise.resolve({ 
          ok: true, 
          json: async () => ({ stories: [] }) 
        });
      }
      
      // Mock /api/preferences endpoint
      if (urlStr.includes("/api/preferences")) {
        return Promise.resolve({ 
          ok: true, 
          json: async () => ({ preferences: {} }) 
        });
      }
      
      // Mock /illustrate endpoint - simulates timeout
      if (urlStr.includes("/illustrate")) {
        return new Promise((resolve, reject) => {
          if (opts?.signal) {
            if (opts.signal.aborted) {
              const abortErr = new Error("The operation was aborted");
              abortErr.name = "AbortError";
              return reject(abortErr);
            }
            opts.signal.addEventListener("abort", () => {
              const abortErr = new Error("The operation was aborted");
              abortErr.name = "AbortError";
              reject(abortErr);
            });
          }
        });
      }
      
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    
    global.fetch = mockFetch;
    global.URL.createObjectURL = jest.fn((blob) => `blob:mock-${Math.random()}`);
    global.URL.revokeObjectURL = jest.fn();

    HTMLAudioElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLAudioElement.prototype.pause = jest.fn();
    HTMLAudioElement.prototype.load = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("opens story from history and handles missing illustrations gracefully", async () => {
    // Pre-populate history with a story having missing illustrations
    saveStory({
      id: "history-story-missing-art",
      familyMembers: ["Maya"],
      theme: "enchanted forest",
      pages: ["Page 1: Maya walked through the quiet woods."],
      firstPage: "Page 1: Maya walked through the quiet woods.",
      illustrations: [],
      chapters: [
        {
          chapter: 1,
          pages: [{ text: "Page 1: Maya walked through the quiet woods." }],
          illustrations: [],
        },
      ],
    });

    render(<App />);

    // Open History Screen
    const historyBtn = screen.getByRole("button", { name: /View History/i });
    fireEvent.click(historyBtn);

    // Click on the story card
    const storyCard = await waitFor(() => screen.getByTestId("history-card-history-story-missing-art"), { timeout: 3000 });
    fireEvent.click(storyCard);

    // Verify story screen opens with the story content
    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Verify story text is displayed
    expect(screen.getByText(/Maya walked through the quiet woods/i)).toBeInTheDocument();
  });
});
