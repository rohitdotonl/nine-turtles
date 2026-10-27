import { describe, expect, it } from "vitest";
import {
  creationOptions,
  explainAdd,
  explainPasskeySignIn,
  fromBase64Url,
  passkeyDates,
  passkeyName,
  passkeysHere,
  requestOptions,
  toBase64Url,
} from "./passkeys";

describe("base64url, as WebAuthn's JSON writes bytes", () => {
  it("goes both ways, without padding, with - and _ for + and /", () => {
    const bytes = new Uint8Array([0, 251, 255, 63, 1]);
    expect(toBase64Url(bytes)).toBe("APv_PwE");
    expect([...fromBase64Url("APv_PwE")]).toEqual([...bytes]);
    expect([...fromBase64Url("APv_PwE=")]).toEqual([...bytes]);
    expect(toBase64Url(new Uint8Array([]))).toBe("");
    expect(toBase64Url(bytes.buffer)).toBe("APv_PwE");
  });
});

describe("the server's challenges, as the browser takes them", () => {
  it("turns the challenge, the reader's handle and the passkeys to leave out into bytes", () => {
    const options = creationOptions({
      publicKey: {
        rp: { id: "app.nineturtles.app", name: "nine turtles" },
        user: { id: "AQID", name: "reader@example.com", displayName: "reader@example.com" },
        challenge: "BAUG",
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        excludeCredentials: [{ type: "public-key", id: "Bwg" }],
        authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      },
    });
    expect([...(options.challenge as Uint8Array)]).toEqual([4, 5, 6]);
    expect([...(options.user.id as Uint8Array)]).toEqual([1, 2, 3]);
    expect(options.user.name).toBe("reader@example.com");
    expect([...(options.excludeCredentials?.[0]?.id as Uint8Array)]).toEqual([7, 8]);
    expect(options.authenticatorSelection?.residentKey).toBe("required");
    expect(options.rp.id).toBe("app.nineturtles.app");
  });

  it("asks any of the site's passkeys to sign in", () => {
    const options = requestOptions({ publicKey: { challenge: "BAUG", rpId: "localhost", allowCredentials: [], userVerification: "required" } });
    expect([...(options.challenge as Uint8Array)]).toEqual([4, 5, 6]);
    expect(options.allowCredentials).toEqual([]);
    expect(options.rpId).toBe("localhost");
  });
});

describe("where passkeys are offered", () => {
  const at = (address: string) => {
    const url = new URL(address);
    return { origin: url.origin, protocol: url.protocol, hostname: url.hostname };
  };

  it("only at the address they belong to, in a browser that has them", () => {
    const live = "https://app.nineturtles.app";
    expect(passkeysHere(live, at("https://app.nineturtles.app/settings"), true)).toBe(true);
    expect(passkeysHere(live, at("https://slowfeed.onrender.com/"), true)).toBe(false);
    expect(passkeysHere(live, at("https://app.nineturtles.app/"), false)).toBe(false);
    expect(passkeysHere(null, at("https://app.nineturtles.app/"), true)).toBe(false);
  });

  it("on localhost at any port, when nine turtles has no public address", () => {
    expect(passkeysHere("http://localhost", at("http://localhost:8080/"), true)).toBe(true);
    expect(passkeysHere("http://localhost", at("http://127.0.0.1:8080/"), true)).toBe(false);
  });
});

describe("what a passkey is called", () => {
  const added = new Date(2026, 9, 27, 10).getTime() / 1000;

  it("by the reader's name for it, or the day it was added", () => {
    expect(passkeyName({ id: 1, name: "Laptop", createdAt: added, lastUsedAt: null })).toBe("Laptop");
    expect(passkeyName({ id: 1, name: null, createdAt: added, lastUsedAt: null })).toBe("Passkey added 27 October 2026");
  });

  it("with when it was added and last used underneath", () => {
    const later = new Date(2026, 9, 30, 9);
    expect(passkeyDates({ id: 1, name: null, createdAt: added, lastUsedAt: null }, later)).toBe(
      "Added 27 October 2026 · Not used yet",
    );
    expect(passkeyDates({ id: 1, name: null, createdAt: added, lastUsedAt: later.getTime() / 1000 }, later)).toBe(
      "Added 27 October 2026 · Last used today",
    );
  });
});

describe("what's said when a passkey didn't work", () => {
  it("is plain, and nothing at all when the reader cancelled signing in", () => {
    expect(explainPasskeySignIn("cancelled")).toBe("");
    expect(explainPasskeySignIn("passkey")).toBe("That passkey isn't one this nine turtles knows. Sign in with your password.");
    expect(explainAdd({ ok: false, reason: "wrong-password" })).toBe("That isn't your password.");
    expect(explainAdd({ ok: false, reason: "wait", waitSeconds: 120 })).toBe("Too many wrong tries. Try again in 2 minutes.");
    expect(explainAdd({ ok: false, reason: "already" })).toBe("This device already has a passkey for you.");
  });
});
