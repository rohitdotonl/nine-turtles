import { describe, expect, it } from "vitest";
import { serverAddress } from "./apps";

describe("the server address apps are given", () => {
  it("is this site's address and the API's path", () => {
    expect(serverAddress("https://app.nineturtles.app")).toBe("https://app.nineturtles.app/api/greader");
    expect(serverAddress("http://localhost:8080/")).toBe("http://localhost:8080/api/greader");
  });
});
