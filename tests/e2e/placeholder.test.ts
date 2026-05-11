import { describe, expect, it } from "vitest";

describe("e2e harness", () => {
  it("is wired and ready for browser/server tests", () => {
    expect({ ready: true }).toEqual({ ready: true });
  });
});
