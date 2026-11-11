// Notes and highlights (SPEC section 42): the reader's highlights on the
// open article, their note on the whole of it, and how each change reaches
// the server. Without a connection a change is kept on this device and sent
// once the connection is back, in the order it was made; until then the
// article says so in one quiet line (OFFLINE_LINE). A highlight made offline
// has a number below 0 until the server gives it its own. Each new highlight
// carries a key made here, so one sent twice (its first answer never came,
// say the page was reloaded meanwhile) is saved once (decision 0255).

import { isRecord, sendChange } from "./http";
import { connection, whenBack } from "./connection.svelte";
import { deviceJson, setDeviceText } from "./device";
import { renameDraft } from "./drafts";
import { currentTabReader } from "./updates.svelte";
import { toNote, type FullArticle, type Note } from "./shapes";
import { UNDO_FAILED } from "./messages";

export const OFFLINE_LINE = "You're offline. This is saved on this device only, and reaches your account once you're back online.";

/** The longest note the server keeps (server/src/notes.rs → LONGEST_NOTE). */
export const LONGEST_NOTE = 5000;

/** The words a new highlight holds: the quote, and a little of the text either side of it. */
export type Quote = { quote: string; before: string; after: string };

/** A change made without a connection, waiting on this device to be sent. */
export type Waiting =
  | ({ kind: "highlight"; article: number; id: number; note: string | null; madeAt: number; key?: string } & Quote)
  | { kind: "change"; article: number; id: number; note: string | null }
  | { kind: "remove"; article: number; id: number }
  | { kind: "article-note"; article: number; note: string | null };

/** Changes still waiting, oldest first (kept for each reader, on this device). */
export const waiting: { list: Waiting[] } = $state({ list: [] });

function key(): string {
  return `nine-turtles.notes-waiting.${currentTabReader() ?? "me"}`;
}

/** Reads what's waiting from this device; anything unreadable is left out. */
export function loadWaiting(): void {
  const saved = deviceJson(key());
  waiting.list = Array.isArray(saved) ? saved.filter((each): each is Waiting => isRecord(each) && typeof each.kind === "string") : [];
}

function save() {
  setDeviceText(key(), waiting.list.length > 0 ? JSON.stringify(waiting.list) : null);
}

/**
 * Adds a change to those waiting, folded into what's already there: a note
 * changed on a highlight made offline goes into that highlight, a highlight
 * made and removed offline is simply gone, and a later note replaces an
 * earlier one, so only what's needed is sent.
 */
export function folded(list: Waiting[], change: Waiting): Waiting[] {
  if (change.kind === "change" && change.id < 0)
    return list.map((each) => (each.kind === "highlight" && each.id === change.id ? { ...each, note: change.note } : each));
  if (change.kind === "remove" && change.id < 0) return list.filter((each) => !(each.kind === "highlight" && each.id === change.id));
  if (change.kind === "change" || change.kind === "remove")
    return [...list.filter((each) => !(each.kind === "change" && each.id === change.id)), change];
  if (change.kind === "article-note")
    return [...list.filter((each) => !(each.kind === "article-note" && each.article === change.article)), change];
  return [...list, change];
}

/** The article's notes as the server sent them, with the changes still waiting on this device made to them. */
export function withWaiting(notes: Note[], article: number, list: Waiting[]): Note[] {
  let now = [...notes];
  for (const change of list) {
    if (change.article !== article) continue;
    if (change.kind === "highlight") now.push({ id: change.id, quote: change.quote, before: change.before, after: change.after, note: change.note, madeAt: change.madeAt });
    if (change.kind === "change") now = now.map((each) => (each.id === change.id ? { ...each, note: change.note } : each));
    if (change.kind === "remove") now = now.filter((each) => each.id !== change.id);
    if (change.kind === "article-note") {
      const whole = now.find((each) => each.quote === null);
      now = now.filter((each) => each.quote !== null);
      if (change.note) now.push({ id: whole?.id ?? 0, quote: null, before: "", after: "", note: change.note, madeAt: whole?.madeAt ?? 0 });
    }
  }
  return now;
}

/** What a change asks the server: where, and with what. */
function request(change: Waiting): [string, unknown] {
  switch (change.kind) {
    case "highlight":
      return [`/api/articles/${change.article}/highlights`, { quote: change.quote, before: change.before, after: change.after, note: change.note, key: change.key }];
    case "change":
      return [`/api/highlights/${change.id}`, { note: change.note ?? "" }];
    case "remove":
      return [`/api/highlights/${change.id}/delete`, {}];
    case "article-note":
      return [`/api/articles/${change.article}/note`, { note: change.note ?? "" }];
  }
}

/** What the server answered a change: what it made, or why it didn't take it. */
type Sent = { answer?: Record<string, unknown>; refusal?: string };

/**
 * Sends one change. "offline" when there's no connection (it should wait);
 * otherwise the server's answer, or why it wasn't taken (too long, an
 * article or highlight that's gone, a problem on the server).
 */
async function send(change: Waiting): Promise<Sent | "offline"> {
  if (connection.offline) return "offline";
  const [path, body] = request(change);
  const { answer, refusal } = await sendChange(path, body, ["too-long", "no-quote"]);
  if (refusal === "trouble" && connection.offline) return "offline";
  return { answer, refusal };
}

/** What couldn't be done and what to do, by the kind of change, when the trouble was nine turtles' own (decision 0239). */
const FAILED: Record<"highlight" | "remove", string> = {
  highlight: "The highlight couldn't be saved. Choose the words and press Highlight again in a moment.",
  remove: "The highlight couldn't be removed, so it's still here. Try again in a moment.",
};

/** A note that couldn't be saved: its box stays open with the words (decision 0235), and says so under them. */
export const NOTE_NOT_SAVED = "The note couldn't be saved, so your words are still here. Try again in a moment.";

/** Why a change wasn't kept, in plain words (shown, never silently dropped). */
function notKept(refusal: string, kind: Waiting["kind"]): string {
  if (refusal === "too-long") return "That note is too long. Make it shorter.";
  if (refusal === "no-quote") return "Those words couldn't be highlighted. Choose fewer.";
  if (refusal === "gone") return "That article or highlight is no longer here, so it couldn't be saved.";
  if (kind === "change" || kind === "article-note") return NOTE_NOT_SAVED;
  return FAILED[kind];
}

/**
 * The changes still waiting once `sent`, the first, has been sent: by itself,
 * not by its place, as changes go on being folded in while it's on its way.
 * A highlight given a note meanwhile has that note sent next, under the
 * number the server gave it (`made`); one removed meanwhile is removed there too.
 */
export function afterSent(list: Waiting[], sent: Waiting, made?: number): Waiting[] {
  if (sent.kind !== "highlight" || list.includes(sent)) return list.filter((each) => each !== sent);
  const now = list.find((each) => each.kind === "highlight" && each.id === sent.id);
  // The server didn't take it: whatever was folded into it goes with it.
  if (made === undefined) return list.filter((each) => each !== now);
  if (now?.kind === "highlight") return list.map((each) => (each === now ? { kind: "change", article: sent.article, id: made, note: now.note } : each));
  return [{ kind: "remove", article: sent.article, id: made }, ...list];
}

let sending = false;

/** Sends the waiting changes in order, stopping if the connection goes again. A highlight made offline takes the server's number. */
export async function sendWaiting(): Promise<void> {
  if (sending) return;
  sending = true;
  try {
    while (waiting.list.length > 0 && !connection.offline) {
      const change = waiting.list[0]!;
      const sent = await send(change);
      if (sent === "offline") break;
      // One the server won't take (an article gone meanwhile) isn't sent again; the article shows the account's own once reopened.
      const made = change.kind === "highlight" && isRecord(sent.answer?.highlight) ? toNote(sent.answer.highlight) : undefined;
      waiting.list = afterSent(waiting.list, change, made?.id);
      save();
      if (made && change.kind === "highlight") {
        // A note left unsaved on it follows it to its number (decision 0235).
        renameDraft(`note:highlight:${change.id}`, `note:highlight:${made.id}`);
        renumbered.get(change.article)?.(change.id, made.id);
      }
    }
  } finally {
    sending = false;
  }
}

/** The open article's Marks, told when a highlight made offline gets its number. */
const renumbered = new Map<number, (was: number, now: number) => void>();

whenBack(() => void sendWaiting());

let temporary = 0;

/** A new highlight's own key: random, so the server knows it again if it's sent twice (decision 0255). */
function newKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * One article's highlights and note, as the reading area shows them, and
 * the reader's changes to them. Each change shows at once; it's sent to the
 * server, or kept on this device to send later.
 */
export class Marks {
  notes: Note[] = $state([]);
  private full: FullArticle;
  /**
   * A highlight still on its way to the server has only a stand-in number
   * (below zero), which a menu or box opened meanwhile may still hold.
   * Removing it or changing its note waits for its own number, here (none if
   * its save was refused), and `renamed` finds it by the stand-in afterwards.
   * A refused one's words stay in `lost`, for a note written on it meanwhile.
   */
  private saving = new Map<number, Promise<number | undefined>>();
  private renamed = new Map<number, number>();
  private lost = new Map<number, Quote>();

  constructor(full: FullArticle) {
    this.full = full;
    loadWaiting();
    this.notes = withWaiting(full.notes ?? [], full.id, waiting.list);
    renumbered.set(full.id, (was, now) => {
      this.renamed.set(was, now);
      // Sent before, it's already here under that number (from the server): this one, with what was done to it since, takes its place.
      const twice = this.notes.some((each) => each.id === was);
      this.keep(this.notes.filter((each) => !twice || each.id !== now).map((each) => (each.id === was ? { ...each, id: now } : each)));
    });
    // Changes left waiting (the page was reloaded or closed before they were sent) go now, if there's a connection.
    if (waiting.list.length > 0) void sendWaiting();
  }

  /** This article has changes still waiting on this device. */
  get waits(): boolean {
    return waiting.list.some((each) => each.article === this.full.id);
  }

  /** The highlights, in the order they were made. */
  get highlights(): Note[] {
    return this.notes.filter((each) => each.quote !== null);
  }

  /** The note on the whole article, if there is one. */
  get articleNote(): Note | undefined {
    return this.notes.find((each) => each.quote === null);
  }

  /** Stops listening for new numbers (another article opened). */
  close() {
    renumbered.delete(this.full.id);
  }

  private keep(notes: Note[]) {
    this.notes = notes;
    // The article's loaded copy shows the same when it's opened again.
    this.full.notes = notes;
  }

  /**
   * Sends a change, or keeps it on this device. If the server won't take
   * it, what was shown goes back (`back`: worked out then, so only this
   * change is undone, whatever else was done meanwhile) and the answer
   * says why, in plain words, for the reader to see.
   */
  private async change(change: Waiting, back: () => Note[]): Promise<Sent> {
    const sent = waiting.list.length > 0 ? "offline" : await send(change);
    if (sent === "offline") {
      waiting.list = folded(waiting.list, change);
      save();
      // Online, behind changes that were waiting: they're sent now, this one after them.
      if (!connection.offline) void sendWaiting();
      return {};
    }
    if (sent.refusal) {
      this.keep(back());
      return { refusal: notKept(sent.refusal, change.kind) };
    }
    return sent;
  }

  /** Highlights the words; answers the new highlight, or why it couldn't be kept. */
  async highlight(quote: Quote, note: string | null = null): Promise<{ made?: Note; problem?: string; lost?: number }> {
    const made: Note = { id: -(Date.now() + ++temporary), ...quote, note, madeAt: Math.floor(Date.now() / 1000) };
    this.keep([...this.notes, made]);
    const sent = this.change({ kind: "highlight", article: this.full.id, ...made, ...quote, key: newKey() }, () => this.notes.filter((each) => each.id !== made.id));
    // Kept offline, it keeps the stand-in, which the waiting changes know it by; refused, it has none.
    this.saving.set(made.id, sent.then(({ answer, refusal }) => (refusal ? undefined : isRecord(answer?.highlight) ? toNote(answer.highlight).id : made.id)));
    const { answer, refusal } = await sent;
    if (refusal) {
      // Its words are kept, for a note written on it meanwhile to highlight them again.
      this.lost.set(made.id, quote);
      return { problem: refusal, lost: made.id };
    }
    const saved = isRecord(answer?.highlight) ? toNote(answer.highlight) : undefined;
    if (saved) {
      this.renamed.set(made.id, saved.id);
      // A note given meanwhile (setNote, waiting for this number) stays: it's sent next.
      this.keep(this.notes.map((each) => (each.id === made.id ? { ...saved, note: each.note } : each)));
      // A note left unsaved on it follows it to its number (decision 0235).
      renameDraft(`note:highlight:${made.id}`, `note:highlight:${saved.id}`);
    }
    return { made: saved ?? made };
  }

  /** The highlight's number here now: its own, once a stand-in's save has answered. */
  here(id: number): number {
    // Made offline, then given its number once sent, it was renamed twice.
    for (let now = this.renamed.get(id); now !== undefined; now = this.renamed.get(id)) id = now;
    return id;
  }

  /** The words of a highlight whose save was refused, if this was one. */
  lostQuote(id: number): Quote | undefined {
    return this.lost.get(this.here(id));
  }

  /** Its number on the server, waiting for its save if need be; none if that save was refused. */
  private async onServer(id: number): Promise<number | undefined> {
    // Made again after a refused save, it's the new one that's asked about.
    const now = this.here(id);
    const known = this.saving.has(now) ? await this.saving.get(now) : now;
    // Made offline, it takes its number when it's sent later (`renumbered`).
    return known === undefined ? undefined : this.here(known);
  }

  /** Changes a highlight's note; an empty one takes it off. Answers why, if it couldn't be kept. */
  async setNote(id: number, note: string | null): Promise<string | undefined> {
    const was = this.notes.find((each) => each.id === this.here(id));
    const clean = note?.trim() || null;
    this.keep(this.notes.map((each) => (each.id === this.here(id) ? { ...each, note: clean } : each)));
    const server = await this.onServer(id);
    // Its highlight couldn't be saved (and the reader was told): Save highlights its words again, with the note.
    if (server === undefined) return this.again(id, clean);
    const back = () => this.notes.map((each) => (each.id === this.here(id) ? { ...each, note: was?.note ?? null } : each));
    return (await this.change({ kind: "change", article: this.full.id, id: server, note: clean }, back)).refusal;
  }

  /** A note on a highlight whose save was refused: its words are highlighted again, with it. If that's refused too, the words stay in the box. */
  private async again(id: number, note: string | null): Promise<string | undefined> {
    const at = this.here(id);
    const quote = this.lost.get(at);
    if (!quote) return NOTE_NOT_SAVED;
    const { made, problem } = await this.highlight(quote, note);
    if (!made) return problem ?? NOTE_NOT_SAVED;
    this.lost.delete(at);
    this.renamed.set(at, made.id);
    return undefined;
  }

  /** Removes a highlight (and its note). Answers it, for Undo, or why it couldn't be removed. */
  async remove(id: number): Promise<{ was?: Note; problem?: string }> {
    const at = this.notes.findIndex((each) => each.id === this.here(id));
    const was = this.notes[at];
    if (!was) return {};
    this.keep(this.notes.filter((each) => each.id !== was.id));
    const server = await this.onServer(id);
    // Its save was refused: it's gone already, and the reader was told why.
    if (server === undefined) return {};
    const kept = { ...was, id: this.here(id) };
    const back = () => [...this.notes.slice(0, at), kept, ...this.notes.slice(at)];
    const { refusal } = await this.change({ kind: "remove", article: this.full.id, id: server }, back);
    return refusal ? { problem: refusal } : { was: kept };
  }

  /** Undo for a removed highlight: it's made again, with its note. Answers why, if it couldn't be. */
  async restore(was: Note): Promise<string | undefined> {
    if (was.quote === null) return undefined;
    const { problem } = await this.highlight({ quote: was.quote, before: was.before, after: was.after }, was.note);
    // Trouble on nine turtles' side is the one failed-Undo line (BRAND.md → "Messages").
    return problem === notKept("trouble", "highlight") ? UNDO_FAILED : problem;
  }

  /** Sets the note on the whole article; an empty one removes it. Answers why, if it couldn't be kept. */
  async setArticleNote(note: string | null): Promise<string | undefined> {
    const before = this.notes;
    const clean = note?.trim() || null;
    this.keep(withWaiting(this.notes, this.full.id, [{ kind: "article-note", article: this.full.id, note: clean }]));
    return (await this.change({ kind: "article-note", article: this.full.id, note: clean }, () => before)).refusal;
  }
}
