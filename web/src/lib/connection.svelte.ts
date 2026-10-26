// Whether nine turtles can be reached from this device (reading offline,
// SPEC section 31). Every request to the server says so: an answer means the
// connection is there; a request that never got one (the browser couldn't
// connect at all) means it isn't. Only then does the app switch to the
// copies kept on this device; a server that answers "busy" or restarts is
// not "offline".
//
// It also keeps how far this device's clock is from the server's, so a mark
// made offline says when it was made in the server's time (decision 0100).

export const connection = $state({ offline: false });

const backAgain = new Set<() => void>();

/** Runs `then` each time the connection comes back after being lost. Returns how to stop. */
export function whenBack(then: () => void): () => void {
  backAgain.add(then);
  return () => backAgain.delete(then);
}

/** An answer arrived: the connection is there. */
export function reached(response: Response) {
  const date = Date.parse(response.headers.get("date") ?? "");
  if (Number.isFinite(date)) clockOffset = offsetFrom(date, Date.now(), clockOffset);
  if (!connection.offline) return;
  connection.offline = false;
  for (const then of [...backAgain]) then();
}

/** A request got no answer at all. */
export function lost() {
  connection.offline = true;
}

/** Whether a failed request failed for want of a connection, rather than being refused. */
export function noConnection(problem: unknown): boolean {
  if (globalThis.navigator?.onLine === false) return true;
  // fetch says it never reached the server with a TypeError; a timeout is an abort.
  return problem instanceof TypeError || (problem instanceof DOMException && problem.name === "TimeoutError");
}

let clockOffset = 0;

/**
 * The server's clock from an answer's Date header, which counts whole
 * seconds: a difference under two seconds is the header rounding, not the
 * clocks, so it's left as it was.
 */
export function offsetFrom(serverDate: number, deviceNow: number, previous: number): number {
  const offset = serverDate - deviceNow;
  return Math.abs(offset - previous) < 2_000 ? previous : offset;
}

/** Now, in milliseconds since 1970, by the server's clock as best this device knows it. */
export function serverNow(): number {
  return Date.now() + clockOffset;
}

if (typeof addEventListener === "function") {
  addEventListener("offline", lost);
}
