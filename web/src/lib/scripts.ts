/**
 * Writing in other scripts (decision 0221). The server marks each article
 * with its language, checked against its letters (server/src/feeds/language.rs);
 * this says which of those languages are written right to left.
 */
const RIGHT_TO_LEFT = new Set(["ar", "fa", "ur", "ps", "ckb", "sd", "ug", "ku", "he", "iw", "yi", "lad", "dv", "syr"]);

/** Whether an article in this language (`ar`, `he-IL`…) reads right to left. */
export function rightToLeft(language: string | null | undefined): boolean {
  return !!language && RIGHT_TO_LEFT.has((language.split("-")[0] ?? "").toLowerCase());
}
