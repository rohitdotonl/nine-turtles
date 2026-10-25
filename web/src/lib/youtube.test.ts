import { describe, expect, it } from "vitest";
import { playerAddress, youtubeVideo } from "./youtube";

describe("which articles are YouTube videos", () => {
  it("finds the video in every kind of YouTube address", () => {
    for (const address of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?t=42",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ]) {
      expect(youtubeVideo(address), address).toBe("dQw4w9WgXcQ");
    }
  });

  it("finds none anywhere else, or in an address that isn't a video", () => {
    for (const address of [
      undefined,
      "",
      "not an address",
      "https://www.youtube.com/",
      "https://www.youtube.com/@channel",
      "https://www.youtube.com/watch?v=short",
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ"',
      "https://example.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be.example.com/dQw4w9WgXcQ",
      "javascript://youtu.be/dQw4w9WgXcQ",
    ]) {
      expect(youtubeVideo(address), String(address)).toBeUndefined();
    }
  });

  it("plays in YouTube's privacy-enhanced player", () => {
    expect(playerAddress("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
  });
});
