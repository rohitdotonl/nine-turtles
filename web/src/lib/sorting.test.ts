import { describe, expect, it } from "vitest";
import { addedLine, isOpen, sortedLine, toSorted, toWhy, whyLine } from "./sorting";

describe("person or publication, and why", () => {
  it("says why on their page, and nothing for one sorted before", () => {
    expect(whyLine("one-name")).toBe("nine turtles chose this: one name signs every article.");
    expect(whyLine("own-site")).toBe("nine turtles chose this: the site is someone's own.");
    expect(whyLine("several-names")).toBe("nine turtles chose this: several names sign its articles.");
    expect(whyLine("site-name")).toBe("nine turtles chose this: it writes under its site's own name.");
    expect(whyLine("folder")).toBe("nine turtles chose this from the name of the folder it came in.");
    expect(whyLine("unsure-no-names")).toBe("nine turtles couldn't tell: no name signs their articles. Kept as a publication until you choose.");
    expect(whyLine("unsure-channel")).toBe("nine turtles can't tell a person's channel from a company's. Kept as a publication until you choose.");
    expect(whyLine("reader")).toBe("Your choice.");
    expect(whyLine(null)).toBeUndefined();
  });

  it("says in Add why a tile is chosen, or that none is", () => {
    expect(addedLine("one-name")).toBe("nine turtles chose this: one name signs every article. You can change this later on their page.");
    expect(addedLine("unsure-channel")).toBe(
      "nine turtles couldn't tell from their feed. Left as it is, they're kept with Publications. You can change this later on their page.",
    );
  });

  it("knows who could be either", () => {
    expect(isOpen("unsure-no-names")).toBe(true);
    expect(isOpen("unsure-channel")).toBe(true);
    expect(isOpen("reader")).toBe(false);
    expect(isOpen(null)).toBe(false);
    expect(toWhy("guess")).toBeNull();
  });

  it("says how an import was sorted, leaving out what's none", () => {
    expect(sortedLine({ people: 18, publications: 4, open: 8 })).toBe("Your list is in: 18 people and 4 publications. 8 could be either.");
    expect(sortedLine({ people: 18, publications: 0, open: 0 })).toBe("Your list is in: 18 people.");
    expect(sortedLine({ people: 1, publications: 1, open: 1 })).toBe("Your list is in: 1 person and 1 publication. 1 could be either.");
    expect(sortedLine({ people: 0, publications: 0, open: 3 })).toBe("Your list is in: 3 could be either.");
    expect(toSorted({ people: 0, publications: 0, open: 0 })).toBeUndefined();
    expect(toSorted(null)).toBeUndefined();
  });
});
