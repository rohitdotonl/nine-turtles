// Start reading (SPEC section 7, decision 0206): the words an unread article
// is begun with where nothing is open: its first paragraph, as plain text,
// and its author when that isn't its source's own name. Fetched as opening
// it would be (`readArticle`), which marks nothing read.

import { readArticle } from "./articles";
import type { Article } from "./shapes";

export interface Opening {
  id: number;
  opening: string;
  author?: string;
}

/** The article's first paragraph and author; empty words when it can't be fetched just now. */
export async function openingFor(article: Article): Promise<Opening> {
  try {
    const full = await readArticle(article.id);
    const author = full.author?.trim();
    return {
      id: article.id,
      opening: firstParagraph(full.content) || plain(full.summary),
      author: author && author.toLowerCase() !== article.feedTitle.trim().toLowerCase() ? author : undefined,
    };
  } catch {
    return { id: article.id, opening: "" };
  }
}

/** The first paragraph with words in it, as plain text; else all the words. */
export function firstParagraph(content: string | null | undefined): string {
  if (!content) return "";
  const page = new DOMParser().parseFromString(content, "text/html");
  for (const paragraph of page.querySelectorAll("p")) {
    const words = squeeze(paragraph.textContent);
    if (words) return words;
  }
  return squeeze(page.body.textContent);
}

function plain(html: string | null | undefined): string {
  return html ? squeeze(new DOMParser().parseFromString(html, "text/html").body.textContent) : "";
}

const squeeze = (text: string | null | undefined) => text?.replace(/\s+/g, " ").trim() ?? "";
