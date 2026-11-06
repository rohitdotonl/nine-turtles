// Whether nine turtles is installed here, and the one-press Install that
// Chrome, Edge and Android offer (SPEC section 20, decision 0151). Those
// browsers announce once per page that nine turtles can be installed; the
// announcement is kept from the start (main.ts) so Settings › Install the app on any device
// can offer its Install button whenever it's opened. Nothing else ever shows
// it: no banner, no reminder.

/** The browser's announcement (not in TypeScript's own types yet). */
type InstallOffer = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export const installing = $state({ offer: undefined as InstallOffer | undefined, justInstalled: false });

/** Whether this page is the installed app, in its own window. */
export function runningInstalled(): boolean {
  const apple = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return apple || matchMedia("(display-mode: standalone)").matches;
}

export function listenForInstall(): void {
  addEventListener("beforeinstallprompt", (event) => {
    // Keeps the browser's own mini-bar away on Android: installing is offered only in Settings.
    event.preventDefault();
    installing.offer = event as InstallOffer;
  });
  addEventListener("appinstalled", () => {
    installing.offer = undefined;
    installing.justInstalled = true;
  });
}

/**
 * Shows the browser's own Install dialog and says what the reader chose; the
 * offer can be used once either way. "failed" when the browser refuses to show it.
 */
export async function install(): Promise<"accepted" | "dismissed" | "failed"> {
  const offer = installing.offer;
  if (!offer) return "failed";
  try {
    await offer.prompt();
    const { outcome } = await offer.userChoice;
    if (outcome === "accepted") installing.justInstalled = true;
    return outcome;
  } catch {
    return "failed";
  } finally {
    installing.offer = undefined;
  }
}
