import { describe, expect, it } from "vitest";
import { mcpAddress, readAnswer, readAssistants, readKey, readRequest, shortName } from "./assistants";

describe("the server address assistants are given", () => {
  it("is this site's address and the MCP path", () => {
    expect(mcpAddress("https://app.nineturtles.app")).toBe("https://app.nineturtles.app/mcp");
    expect(mcpAddress("http://localhost:8080/")).toBe("http://localhost:8080/mcp");
  });
});

describe("an assistant's name", () => {
  it("is kept as it is when short, its spaces tidied", () => {
    expect(shortName("  Claude  ")).toBe("Claude");
    expect(shortName("Chat\n  GPT")).toBe("Chat GPT");
  });
  it("is cut short with an ellipsis when very long", () => {
    const cut = shortName("a".repeat(200));
    expect(Array.from(cut)).toHaveLength(60);
    expect(cut.endsWith("…")).toBe(true);
  });
  it("is never treated as markup", () => {
    expect(shortName("<b>Claude</b>")).toBe("<b>Claude</b>");
  });
});

describe("what is asking to connect", () => {
  it("reads the assistant's name and where the reader goes back to", () => {
    expect(readRequest(200, { client_name: "Claude", redirect_host: "claude.ai" })).toEqual({
      kind: "ok",
      clientName: "Claude",
      redirectHost: "claude.ai",
    });
  });
  it("says a link isn't valid, whatever the reason", () => {
    for (const error of ["unknown-client", "bad-redirect", "bad-request"]) {
      expect(readRequest(400, { error })).toEqual({ kind: "invalid" });
    }
  });
  it("notices being signed out, and answers that make no sense", () => {
    expect(readRequest(401, null)).toEqual({ kind: "signed-out" });
    expect(readRequest(500, null)).toEqual({ kind: "trouble" });
    expect(readRequest(200, { client_name: 3 })).toEqual({ kind: "trouble" });
  });
});

describe("the answer to Connect or Cancel", () => {
  it("is where to send the reader", () => {
    expect(readAnswer(200, { redirect: "https://claude.ai/callback?code=x&state=y" })).toEqual({
      kind: "redirect",
      url: "https://claude.ai/callback?code=x&state=y",
    });
  });
  it("never sends the reader to a script", () => {
    expect(readAnswer(200, { redirect: "javascript:alert(1)" })).toEqual({ kind: "trouble" });
    expect(readAnswer(200, { redirect: "data:text/html,hi" })).toEqual({ kind: "trouble" });
  });
  it("passes on refusals", () => {
    expect(readAnswer(400, { error: "bad-request" })).toEqual({ kind: "invalid" });
    expect(readAnswer(401, null)).toEqual({ kind: "signed-out" });
    expect(readAnswer(200, {})).toEqual({ kind: "trouble" });
  });
});

describe("the connected assistants", () => {
  it("reads each connection and each feed kept after an assistant unsubscribed", () => {
    expect(
      readAssistants({
        assistants: [
          { id: 3, name: "Claude", connected_at: 1793000000, last_used_at: 1793050000 },
          { id: 4, name: "Assistant key", connected_at: 1793000001, last_used_at: null },
          { id: "x", name: "broken" },
        ],
        unsubscribed: [{ feed_id: 12, title: "Some blog", unsubscribed_at: 1793000000, kept_until: 1795592000 }, { feed_id: 13 }],
      }),
    ).toEqual({
      assistants: [
        { id: 3, name: "Claude", connectedAt: 1793000000, lastUsedAt: 1793050000 },
        { id: 4, name: "Assistant key", connectedAt: 1793000001, lastUsedAt: null },
      ],
      unsubscribed: [{ feedId: 12, title: "Some blog", unsubscribedAt: 1793000000, keptUntil: 1795592000 }],
    });
  });
  it("is empty when the server sends nothing usable", () => {
    expect(readAssistants(null)).toEqual({ assistants: [], unsubscribed: [] });
    expect(readAssistants({ assistants: [] })).toEqual({ assistants: [], unsubscribed: [] });
  });
});

describe("a new assistant key", () => {
  it("is read with the connection it made", () => {
    const key = `nt_${"a".repeat(64)}`;
    expect(readKey({ key, assistant: { id: 5, name: "Assistant key", connected_at: 1793000000, last_used_at: null } })).toEqual({
      key,
      assistant: { id: 5, name: "Assistant key", connectedAt: 1793000000, lastUsedAt: null },
    });
  });
  it("is nothing when the answer is missing a part", () => {
    expect(readKey({ key: "nt_x" })).toBeUndefined();
    expect(readKey({ assistant: { id: 5, name: "x", connected_at: 1 } })).toBeUndefined();
  });
});
