/**
 * Writing in other scripts (decision 0223). The server marks each article
 * with its language, checked against its letters (server/src/feeds/language.rs);
 * this says which script family that language is set as, for the type
 * settings in scripts.css (one list here, so every rule agrees), and which
 * read right to left. Languages also often written in Latin letters (Kurmanji
 * Kurdish `ku`, Azerbaijani, Malay, Punjabi in Gurmukhi) are left out, so a
 * Latin article tagged with one is never turned around.
 */
export type ScriptFamily = "devanagari" | "arabic" | "hebrew" | "cjk";

const FAMILIES: Record<ScriptFamily, string[]> = {
  devanagari: ["hi", "mr", "ne", "sa", "mai", "bho", "kok", "doi", "new"],
  arabic: ["ar", "fa", "ur", "ps", "ckb", "sd", "ug", "ks", "bal"],
  hebrew: ["he", "iw", "yi", "lad"],
  cjk: ["zh", "ja", "ko", "yue", "nan", "hak", "wuu", "gan", "lzh"],
};

/** Right to left besides Arabic and Hebrew letters: Thaana (Dhivehi) and Syriac. */
const OTHER_RIGHT_TO_LEFT = ["dv", "syr"];

function primary(language: string): string {
  return (language.split("-")[0] ?? "").toLowerCase();
}

/** The script family an article in this language (`hi`, `ar-EG`…) is set as, if it has its own settings. */
export function scriptFamily(language: string | null | undefined): ScriptFamily | undefined {
  if (!language) return undefined;
  const code = primary(language);
  return (Object.keys(FAMILIES) as ScriptFamily[]).find((family) => FAMILIES[family].includes(code));
}

/** Whether an article in this language (`ar`, `he-IL`…) reads right to left. */
export function rightToLeft(language: string | null | undefined): boolean {
  const family = scriptFamily(language);
  return family === "arabic" || family === "hebrew" || (!!language && OTHER_RIGHT_TO_LEFT.includes(primary(language)));
}
