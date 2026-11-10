// The phone's article bars stepping aside (SPEC section 20, decision 0242):
// one tap on the text puts the top bar and the bottom toolbar away, so the
// page is only the writer's words; another tap, the keyboard reaching
// either bar, a new article, or reaching the article's end brings them back.
// Only the reader's own tap or scroll changes anything, never a timer, and
// nothing slides: the bars are there, then not. The text stays where it was
// on the screen: while they're away, the text's area starts with a space as
// tall as the top bar was and ends with one as tall as the toolbar, so
// nothing in it moves and it scrolls exactly as far as before. A tap that
// closes a menu, the Aa panel or a choice of words only closes it.
//
// Put away, the bars are drawn as `sr-only`: screen readers still have every
// button, and Tab still reaches them (and brings them back).

/** What a tap on these leaves to them: links, buttons, a highlight, a picture, a player, a field. */
const THEIRS = "a, button, input, textarea, select, label, summary, mark, img, video, audio, iframe, [role='button'], [tabindex]";

export class Bars {
  /** Whether the bars are put away. */
  away = $state(false);
  /** While away, the space kept above and below the text, in pixels. */
  room = $state({ above: 0, below: 0 });
  /** This tap started with a menu, a panel or chosen words open: it only closes them. */
  #closing = false;

  /** A press starting anywhere, before any menu closes on it: whether something was open. */
  pressed() {
    const chosen = window.getSelection();
    this.#closing = !!document.querySelector("[role='menu'], [role='dialog']") || (!!chosen && !chosen.isCollapsed);
  }

  /** A tap on the text: puts the bars away or brings them back, unless the tap was for something in the text. */
  tap(event: MouseEvent, scroller: HTMLElement, top: HTMLElement | undefined, bottom: HTMLElement | undefined) {
    const target = event.target;
    const closing = this.#closing;
    this.#closing = false;
    if (closing || event.defaultPrevented || !(target instanceof Element) || target.closest(THEIRS)) return;
    const chosen = window.getSelection();
    if (chosen && !chosen.isCollapsed) return;
    if (!this.away) this.room = { above: top?.offsetHeight ?? 0, below: (bottom?.offsetHeight ?? 0) + parseFloat(getComputedStyle(scroller).paddingBottom) };
    this.away = !this.away;
  }

  /** The reader scrolled: at the article's end the bars come back, with the end still in view. */
  scrolled(scroller: HTMLElement) {
    if (!this.away || scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2) return;
    this.away = false;
    queueMicrotask(() => (scroller.scrollTop = scroller.scrollHeight));
  }

  /** Back, with no scrolling: a new article, or the keyboard reaching a bar. */
  show() {
    this.away = false;
  }
}
