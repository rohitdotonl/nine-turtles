// Svelte drops the spaces at the very start and end of an element's text (and
// of an {#if} or {#each} block's), so
// "to Theo,<space></span>" showed as "to Theo,hello@…" and a screen reader
// heard "Write backTheo". A space that must stay at an element's edge is
// written {" "}; this test finds any written as a plain space.
import { describe, expect, it } from "vitest";
import { parse } from "svelte/compiler";

const sources = import.meta.glob("../**/*.svelte", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

type Node = { type?: string; start: number; end: number; data?: string; nodes?: Node[] };

/**
 * Each stretch of content (an element's, a component's, or an {#if} or {#each}
 * block's) whose first or last text begins or ends with a space on the same
 * line. Svelte sets comments aside before it trims, so they're skipped here too.
 */
function lostSpaces(source: string): string[] {
  const found: string[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    const node = value as Node;
    if (node.type === "Fragment") {
      const kids = (node.nodes ?? []).filter((kid) => kid.type !== "Comment");
      const first = kids[0];
      const last = kids[kids.length - 1];
      const leads = first?.type === "Text" && /^[ \t]/.test(first.data!) && !/^\s*\n/.test(first.data!);
      const trails = last?.type === "Text" && /[ \t]$/.test(last.data!) && !/\n\s*$/.test(last.data!) && (last.data!.trim() !== "" || kids.length > 1);
      const edge = leads ? first! : trails ? last! : undefined;
      if (edge) found.push(source.slice(Math.max(0, edge.start - 40), edge.end + 40).replace(/\s+/g, " "));
    }
    for (const [key, child] of Object.entries(node)) if (key !== "parent") visit(child);
  };
  visit(parse(source, { modern: true }).fragment);
  return found;
}

describe("spaces at an element's edge", () => {
  it("are written {\" \"}, so Svelte keeps them", () => {
    const found = Object.entries(sources).flatMap(([file, source]) => lostSpaces(source).map((element) => `${file}: ${element}`));
    expect(found).toEqual([]);
  });

  it("finds one written as a plain space", () => {
    expect(lostSpaces(`<p><span>to <bdi>{name}</bdi>, </span>{address}</p>`)).toHaveLength(1);
    expect(lostSpaces(`<a>Help<span class="sr-only"> (opens in a new tab)</span></a>`)).toHaveLength(1);
    expect(lostSpaces(`<p>{#if more}Some are shown. {/if}The rest wait.</p>`)).toHaveLength(1);
    expect(lostSpaces(`<span>{name} </span>`)).toHaveLength(1);
    expect(lostSpaces(`<span><!-- why --> {name}</span>`)).toHaveLength(1);
    expect(lostSpaces(`<p><span>to <bdi>{name}</bdi>,{" "}</span>{address}</p>`)).toEqual([]);
  });
});
