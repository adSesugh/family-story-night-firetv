import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AmbientParticles from "../components/AmbientParticles";
import StoryScreen from "../components/StoryScreen";

// Mock swiper to avoid ESM issues in Jest
jest.mock("swiper/react", () => ({
  Swiper: ({ children }) => <div data-testid="swiper-mock">{children}</div>,
  SwiperSlide: ({ children }) => <div data-testid="swiper-slide-mock">{children}</div>,
}));
jest.mock("swiper/modules", () => ({
  Navigation: {},
}));
jest.mock("swiper/css", () => ({}));
jest.mock("swiper/css/navigation", () => ({}));

describe("Living Picture Book: Ambient Particles & Ken Burns Motion", () => {
  test("AmbientParticles renders correct number of floating stardust and firefly motes", () => {
    render(<AmbientParticles count={14} />);

    const container = screen.getByTestId("ambient-particles");
    expect(container).toBeInTheDocument();

    const motes = container.querySelectorAll("span");
    expect(motes.length).toBe(14);
    motes.forEach((mote) => {
      expect(mote.className).toContain("animate-float-mote");
      expect(mote.style.backgroundColor).toBeTruthy();
      expect(mote.style.boxShadow).toBeTruthy();
    });
  });

  test("StoryScreen applies Ken Burns animation class and renders AmbientParticles over illustrations", () => {
    const samplePages = ["Page 1 text", "Page 2 text"];
    const sampleIllustrations = ["data:image/png;base64,img1", "data:image/png;base64,img2"];

    render(
      <StoryScreen
        pages={samplePages}
        illustrations={sampleIllustrations}
        pageIndex={0}
        turnKey={1}
        onTurn={jest.fn()}
      />
    );

    const images = screen.getAllByRole("img");
    expect(images.length).toBe(2);

    // Verify alternating Ken Burns classes
    expect(images[0].className).toContain("animate-kenburns-0");
    expect(images[1].className).toContain("animate-kenburns-1");

    // Verify ambient particles layer is present over illustrations
    const particleContainers = screen.getAllByTestId("ambient-particles");
    expect(particleContainers.length).toBe(2);
  });
});
