import { describe, expect, it } from "vitest";
import { HELP_URL, SETTINGS_PAGES, addressFor, addressWords, articleIn, helpPage, inSettings, knownPath, parentOf, parse, pathFor, nameAddressesBy, rowFor, sidebarViews, titleFor, withArticle, withoutWords, type SettingsPage } from "./router";

describe("addresses", () => {
  it("gives each fixed view and Settings its own address", () => {
    expect(parse("/unread")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/saved/")).toEqual({ kind: "view", view: "starred" });
    // Saved was Starred (decision 0283): its old address still opens it.
    expect(parse("/starred/")).toEqual({ kind: "view", view: "starred" });
    expect(parse("/all")).toEqual({ kind: "view", view: "all" });
    expect(parse("/settings")).toEqual({ kind: "settings" });
    // Everyone you follow has its own address (decision 0266); its old ones under Settings still open it.
    expect(parse("/following")).toEqual({ kind: "your-feeds" });
    expect(parse("/settings/feed-health")).toEqual({ kind: "your-feeds" });
    expect(parse("/settings/feeds")).toEqual({ kind: "your-feeds" });
    expect(parse("/settings/hidden")).toEqual({ kind: "muted" });
    expect(parse("/settings/muted")).toEqual({ kind: "muted" });
    expect(parse("/settings/rules")).toEqual({ kind: "settings", page: "hiding" });
    expect(parse("/settings/readers/all")).toEqual({ kind: "readers" });
    expect(parse("/settings/readers")).toEqual({ kind: "settings", page: "readers" });
    expect(parse("/settings/hiding")).toEqual({ kind: "settings", page: "hiding" });
    expect(parse("/settings/add-from-anywhere/")).toEqual({ kind: "settings", page: "install" });
    expect(parse("/settings/install")).toEqual({ kind: "settings", page: "install" });
    // Pages that went (decision 0187) open Settings itself.
    expect(parse("/settings/font")).toEqual({ kind: "settings" });
    expect(parse("/settings/sidebar")).toEqual({ kind: "settings" });
    expect(parse("/add-feed")).toEqual({ kind: "add-feed" });
    expect(parse("/new-to-feeds")).toEqual({ kind: "new-to-feeds" });
    expect(parse("/12")).toEqual({ kind: "feed", id: 12 });
    expect(parse("/mira-chen-12")).toEqual({ kind: "feed", id: 12 });
    expect(parse("/the-2026-review-7/")).toEqual({ kind: "feed", id: 7 });
    expect(parse("/mira-chen-12/about")).toEqual({ kind: "about", id: 12 });
    expect(parse("/mira-chen-12/settings")).toEqual({ kind: "about", id: 12, settings: true });
    expect(parse("/folders/4")).toEqual({ kind: "folder", id: 4 });
    expect(parse("/folders/friends-4/edit/")).toEqual({ kind: "edit-folder", id: 4 });
  });

  it("only reads well-formed addresses for people and folders", () => {
    expect(parse("/0")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/mira-chen")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/mira-chen-12/edit")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/Mira-Chen-12")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/folders/x/edit")).toEqual({ kind: "view", view: "unread" });
    // The addresses from before decision 0281 are gone, as the owner chose.
    expect(parse("/people/12")).toEqual({ kind: "view", view: "unread" });
    expect(parse("/feeds/12")).toEqual({ kind: "view", view: "unread" });
  });

  it("opens Saved for the front page (decision 0310), and Unread for an unknown address", () => {
    expect(parse("/")).toEqual({ kind: "view", view: "starred" });
    expect(parse("/nowhere")).toEqual({ kind: "view", view: "unread" });
  });

  it("knows its own places, so any other address is a wrong turn", () => {
    for (const path of ["/", "/unread", "/unread/", "/saved", "/starred", "/all", "/settings", "/following", "/settings/feeds", "/mira-chen-12/settings", "/add-feed", "/new-to-feeds", "/12", "/folders/4/edit", "/notes"])
      expect(knownPath(path), path).toBe(true);
    // Recently read, saved searches and collections are gone (decision 0174): their old addresses too.
    for (const path of ["/nowhere", "/0", "/people/12", "/mira-chen-12/more", "/recent", "/searches/7", "/searches/new", "/collections/3", "/blog", "/settings/nothing", "/settings/toString", "/settings/readers/none"])
      expect(knownPath(path), path).toBe(false);
  });

  it("turns a place back into its address and title", () => {
    expect(pathFor({ kind: "view", view: "starred" })).toBe("/saved");
    expect(titleFor({ kind: "view", view: "starred" })).toBe("Saved · nine turtles");
    expect(pathFor({ kind: "settings" })).toBe("/settings");
    expect(titleFor({ kind: "view", view: "all" })).toBe("All articles · nine turtles");
    expect(titleFor({ kind: "settings" })).toBe("Settings · nine turtles");
    // An open article names the tab (decision 0231).
    expect(titleFor({ kind: "feed", id: 3 }, "Reading Room", "The pleasure of a slow letter")).toBe("The pleasure of a slow letter · nine turtles");
    expect(titleFor({ kind: "feed", id: 3 }, "Reading Room", "")).toBe("Reading Room · nine turtles");
    expect(pathFor({ kind: "your-feeds" })).toBe("/following");
    expect(titleFor({ kind: "your-feeds" })).toBe("Everyone you follow · nine turtles");
    expect(pathFor({ kind: "muted" })).toBe("/settings/hidden");
    expect(titleFor({ kind: "muted" })).toBe("Hidden articles · nine turtles");
    expect(pathFor({ kind: "readers" })).toBe("/settings/readers/all");
    expect(pathFor({ kind: "settings", page: "data" })).toBe("/settings/data");
    expect(titleFor({ kind: "settings", page: "data" })).toBe("Your data · nine turtles");
    expect(titleFor({ kind: "readers" })).toBe("All readers · nine turtles");
    expect(pathFor({ kind: "feed", id: 3 })).toBe("/3");
    expect(pathFor({ kind: "about", id: 3 })).toBe("/3/about");
    // Their settings are a page of their own (decision 0267).
    expect(pathFor({ kind: "about", id: 3, settings: true })).toBe("/3/settings");
    expect(titleFor({ kind: "about", id: 3 }, "Alpha")).toBe("Alpha · nine turtles");
    // Their settings name whose they are: the page's heading says only "Settings" (decision 0267).
    expect(titleFor({ kind: "about", id: 3, settings: true }, "Alpha")).toBe("Settings for Alpha · nine turtles");
    expect(titleFor({ kind: "feed", id: 3 }, "Quiet Notes")).toBe("Quiet Notes · nine turtles");
    expect(titleFor({ kind: "add-feed" })).toBe("Add a person or publication · nine turtles");
    expect(pathFor({ kind: "add-feed" })).toBe("/add");
    expect(parse("/add")).toEqual({ kind: "add-feed" });
    expect(titleFor({ kind: "new-to-feeds" })).toBe("New to feeds? · nine turtles");
    expect(pathFor({ kind: "edit-folder", id: 4 })).toBe("/folders/4/edit");
    expect(titleFor({ kind: "folder", id: 4 }, "Tech")).toBe("Tech · nine turtles");
  });

  it("puts the names of people, publications and folders before their numbers (decision 0281)", () => {
    nameAddressesBy({ who: (id) => ({ 54: "Jim Nielsen", 73: "AI as Normal Technology" })[id], folder: (id) => (id === 4 ? "Friends" : undefined) });
    try {
      expect(addressFor({ kind: "feed", id: 54 })).toBe("/jim-nielsen-54");
      expect(addressFor({ kind: "about", id: 54 })).toBe("/jim-nielsen-54/about");
      expect(addressFor({ kind: "about", id: 54, settings: true })).toBe("/jim-nielsen-54/settings");
      expect(addressFor({ kind: "feed", id: 73 })).toBe("/ai-as-normal-technology-73");
      expect(addressFor({ kind: "folder", id: 4 })).toBe("/folders/friends-4");
      expect(addressFor({ kind: "edit-folder", id: 4 })).toBe("/folders/friends-4/edit");
      // No name known (yet), or none in plain letters: the number alone.
      expect(addressFor({ kind: "feed", id: 9 })).toBe("/9");
      expect(addressFor({ kind: "view", view: "starred" })).toBe("/saved");
      // The place itself is still its number, whatever its name.
      expect(pathFor({ kind: "feed", id: 54 })).toBe("/54");
      expect(withoutWords("/jim-nielsen-54/about")).toBe("/54/about");
      expect(withoutWords("/folders/friends-4")).toBe("/folders/4");
      expect(withoutWords("/settings/readers/all")).toBe("/settings/readers/all");
    } finally {
      nameAddressesBy({ who: () => undefined, folder: () => undefined });
    }
  });

  it("makes plain words of any name or title, and leaves out what it can't (decision 0281)", () => {
    expect(addressWords("Café Noël: Ça va? ", 40)).toBe("cafe-noel-ca-va");
    expect(addressWords("This Finally Cut Claude Code's Token Usage", 50)).toBe("this-finally-cut-claude-codes-token-usage");
    expect(addressWords("Straße & Smørrebrød", 40)).toBe("strasse-smorrebrod");
    expect(addressWords("Kırmızı Başlık, Guðmundsson, Ħamrun", 50)).toBe("kirmizi-baslik-gudmundsson-hamrun");
    expect(addressWords("नमस्ते दुनिया", 40)).toBe("");
    expect(addressWords("東京 2026", 40)).toBe("2026");
    expect(addressWords("one two three four five six seven eight nine ten", 30)).toBe("one-two-three-four-five-six");
    expect(addressWords("a".repeat(80), 50)).toBe("");
  });

  it("gives each of Settings' own pages an address that comes back to it (decision 0120)", () => {
    for (const page of Object.keys(SETTINGS_PAGES) as SettingsPage[]) {
      expect(parse(pathFor({ kind: "settings", page }))).toEqual({ kind: "settings", page });
      expect(titleFor({ kind: "settings", page })).toBe(`${SETTINGS_PAGES[page]} · nine turtles`);
    }
  });
});

describe("Settings' pages", () => {
  it("go back to the page that opened them, and to the row that did", () => {
    expect(parentOf({ kind: "settings", page: "hiding" })).toEqual({ kind: "settings" });
    expect(rowFor({ kind: "settings", page: "hiding" })).toBe("hiding");
    // Their settings go back to their page, and to its Settings row (decision 0267).
    expect(parentOf({ kind: "about", id: 3, settings: true })).toEqual({ kind: "about", id: 3 });
    expect(rowFor({ kind: "about", id: 3, settings: true })).toBe("their-settings");
    expect(parentOf({ kind: "muted" })).toEqual({ kind: "settings", page: "hiding" });
    expect(rowFor({ kind: "muted" })).toBe("muted");
    expect(parentOf({ kind: "readers" })).toEqual({ kind: "settings", page: "readers" });
    expect(rowFor({ kind: "readers" })).toBe("all-readers");
  });

  it("leave Settings itself and every other place without a parent", () => {
    expect(parentOf({ kind: "settings" })).toBeUndefined();
    expect(parentOf({ kind: "view", view: "unread" })).toBeUndefined();
    expect(inSettings({ kind: "settings" })).toBe(true);
    expect(inSettings({ kind: "muted" })).toBe(true);
    expect(inSettings({ kind: "add-feed" })).toBe(false);
    // Places of their own, not Settings': Everyone you follow (decision 0266), their page, and their settings (decision 0267).
    expect(parentOf({ kind: "your-feeds" })).toBeUndefined();
    expect(rowFor({ kind: "your-feeds" })).toBeUndefined();
    expect(inSettings({ kind: "your-feeds" })).toBe(false);
    expect(parentOf({ kind: "about", id: 3 })).toBeUndefined();
    expect(inSettings({ kind: "about", id: 3, settings: true })).toBe(false);
  });
});

describe("the Help pages' addresses (decision 0157)", () => {
  it("points at the website's Help, and one page by its file name", () => {
    expect(HELP_URL).toBe("https://nineturtles.app/help/");
    expect(helpPage("every-keyboard-key")).toBe("https://nineturtles.app/help/every-keyboard-key/");
  });
});

describe("the sidebar's lists", () => {
  it("shows Notes from the first day, so its empty list can say how to fill it (decision 0222)", () => {
    expect(sidebarViews(false)).toEqual(["starred", "notes", "all", "unread"]);
    expect(sidebarViews(true)).toEqual(["starred", "notes", "all"]);
  });
});

describe("an open article's address (decisions 0233, 0281)", () => {
  it("sits under its list's, saying what it is, and who wrote it where the list isn't theirs", () => {
    expect(withArticle("/jim-nielsen-54", { id: 5905, title: "Making a Website in 2026" })).toBe("/jim-nielsen-54/making-a-website-in-2026-5905");
    expect(withArticle("/unread", { id: 6373, title: "I moved 39 repos into a monorepo to boost agentic coding", by: "Takuya Matsuyama" })).toBe(
      "/unread/takuya-matsuyama/i-moved-39-repos-into-a-monorepo-to-boost-agentic-6373",
    );
    expect(withArticle("/folders/friends-3", { id: 7, title: "東京", by: "Mira Chen" })).toBe("/folders/friends-3/mira-chen/7");
    expect(withArticle("/unread", { id: 7, title: "", by: "東京" })).toBe("/unread/7");
    expect(withArticle("/folders/3", undefined)).toBe("/folders/3");
  });

  it("is read back into the list and the article, and the list is the place", () => {
    expect(articleIn("/jim-nielsen-54/making-a-website-5905")).toEqual({ list: "/jim-nielsen-54", article: 5905 });
    expect(articleIn("/54/5905")).toEqual({ list: "/54", article: 5905 });
    expect(articleIn("/unread/takuya-matsuyama/i-moved-6373")).toEqual({ list: "/unread", article: 6373 });
    expect(articleIn("/all/3/")).toEqual({ list: "/all", article: 3 });
    expect(articleIn("/folders/friends-3/mira-chen/a-letter-12")).toEqual({ list: "/folders/friends-3", article: 12 });
    expect(articleIn("/jim-nielsen-54")).toEqual({ list: "/jim-nielsen-54" });
    expect(articleIn("/folders/3")).toEqual({ list: "/folders/3" });
    expect(articleIn("/jim-nielsen-54/about")).toEqual({ list: "/jim-nielsen-54/about" });
    expect(articleIn("/unread/a-title-0")).toEqual({ list: "/unread/a-title-0" });
    expect(parse("/folders/friends-3/mira-chen/a-letter-12")).toEqual({ kind: "folder", id: 3 });
    expect(parse("/saved/a-letter-12")).toEqual({ kind: "view", view: "starred" });
    expect(articleIn("/saved/mira-chen/a-letter-12")).toEqual({ list: "/saved", article: 12 });
    expect(articleIn("/starred/mira-chen/a-letter-12")).toEqual({ list: "/starred", article: 12 });
  });

  it("opens only under a list of articles", () => {
    expect(knownPath("/jim-nielsen-54/making-a-website-5905")).toBe(true);
    expect(knownPath("/unread/takuya-matsuyama/i-moved-6373")).toBe(true);
    expect(knownPath("/settings/a-letter-29")).toBe(false);
    expect(knownPath("/nowhere/a-letter-29")).toBe(false);
    expect(knownPath("/jim-nielsen-54/about/29")).toBe(false);
    expect(knownPath("/unread/a/b/a-letter-29")).toBe(false);
  });
});
