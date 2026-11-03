import { describe, expect, it } from "vitest";
import { chapters, foldable, playerAddress, playerNews, question, toPlayer, videoSpeed, youtubeVideo } from "./youtube";

describe("which articles are YouTube videos", () => {
  it("finds the video in every kind of YouTube address", () => {
    for (const address of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?t=42",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0",
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
      "https://www.youtube.com/embed/videoseries?list=PL1",
    ]) {
      expect(youtubeVideo(address), String(address)).toBeUndefined();
    }
  });

  it("plays in YouTube's privacy-enhanced player, from where you stopped", () => {
    expect(playerAddress("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&enablejsapi=1");
    expect(playerAddress("dQw4w9WgXcQ", 240.7, "https://app.nineturtles.app")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&enablejsapi=1&start=240&origin=https%3A%2F%2Fapp.nineturtles.app",
    );
  });
});

describe("talking to YouTube's player", () => {
  it("reads its time, its length and whether it plays, paused or ended", () => {
    expect(playerNews(JSON.stringify({ event: "infoDelivery", info: { currentTime: 12.5, duration: 600, playerState: 1 } }))).toEqual({
      time: 12.5,
      duration: 600,
      state: "playing",
    });
    expect(playerNews(JSON.stringify({ event: "onStateChange", info: 0 }))).toEqual({ state: "ended" });
    expect(playerNews(JSON.stringify({ event: "infoDelivery", info: { volume: 100 } }))).toEqual({});
  });

  it("reads its speed, and only a speed it can play at", () => {
    expect(playerNews(JSON.stringify({ event: "infoDelivery", info: { playbackRate: 1.5 } }))).toEqual({ rate: 1.5 });
    expect(playerNews(JSON.stringify({ event: "onPlaybackRateChange", info: 2 }))).toEqual({ rate: 2 });
    expect(playerNews(JSON.stringify({ event: "onPlaybackRateChange", info: 0 }))).toEqual({});
    expect(playerNews(JSON.stringify({ event: "infoDelivery", info: { playbackRate: 99 } }))).toEqual({});
  });

  it("plays at the speed this device keeps, or at 1×", () => {
    expect(videoSpeed("1.5")).toBe(1.5);
    expect(videoSpeed("0.25")).toBe(0.25);
    for (const kept of [null, "", "fast", "0", "-1", "9"]) expect(videoSpeed(kept)).toBe(1);
    for (const other of ["not json", JSON.stringify({ event: "onReady" }), { event: "infoDelivery" }, null]) {
      expect(playerNews(other)).toBeUndefined();
    }
  });

  it("asks it to listen, and to seek", () => {
    expect(JSON.parse(toPlayer("listening"))).toEqual({ event: "listening", id: 1, channel: "widget" });
    expect(JSON.parse(toPlayer("command", "seekTo", [252, true]))).toEqual({ event: "command", func: "seekTo", args: [252, true], id: 1, channel: "widget" });
  });
});

describe("following a YouTube link", () => {
  it("asks about the channel behind a video or a playlist", () => {
    expect(question("video", "Walks")).toBe("This video is by Walks. Follow Walks?");
    expect(question("playlist", "Walks")).toBe("This playlist is by Walks. Follow all of Walks’s videos, or only the playlist?");
  });
});

describe("a video's description", () => {
  it("finds the chapters it lists, at the start or the end of a line", () => {
    const description =
      "<p>A walk in three parts.</p><p>0:00 Why I wanted fewer tabs<br>4:12 - Finding a site&#39;s feed<br>(1:02:03) What I left out<br>The end – 1:10:00</p>";
    expect(chapters(description)).toEqual([
      { at: 0, title: "Why I wanted fewer tabs" },
      { at: 252, title: "Finding a site's feed" },
      { at: 3723, title: "What I left out" },
      { at: 4200, title: "The end" },
    ]);
  });

  it("finds none in a sentence, from one time alone, or from times out of order", () => {
    expect(chapters("<p>We met at 4:12 and walked on.</p>")).toEqual([]);
    expect(chapters("<p>0:00 Start</p>")).toEqual([]);
    expect(chapters("<p>4:00 Later<br>1:00 Earlier</p>")).toEqual([]);
    expect(chapters("<p>0:00 Start<br>1:75 Not a time</p>")).toEqual([]);
    expect(chapters(null)).toEqual([]);
  });

  it("folds a long description after its first paragraph", () => {
    const long = "word ".repeat(80);
    expect(foldable(`<p>First.</p><p>${long}</p>`)).toBe(true);
    expect(foldable(`<p>${long}</p>`)).toBe(false);
    expect(foldable("<p>First.</p><p>A short second.</p>")).toBe(false);
    expect(foldable(null)).toBe(false);
  });
});
