import { describe, expect, it } from "vitest";
import { parseShareToken, shareUrl } from "./share";

describe("parseShareToken", () => {
  it("reads a full link, a path, and a bare token", () => {
    expect(parseShareToken("https://syncflow-sss.vercel.app/join/Ab3_x-9Kq2LmN0")).toBe("Ab3_x-9Kq2LmN0");
    expect(parseShareToken("  /join/Ab3_x-9Kq2LmN0  ")).toBe("Ab3_x-9Kq2LmN0");
    expect(parseShareToken("Ab3_x-9Kq2LmN0")).toBe("Ab3_x-9Kq2LmN0");
  });

  it("rejects text that can't be a token", () => {
    expect(parseShareToken("")).toBeNull();
    expect(parseShareToken("short")).toBeNull();
    expect(parseShareToken("has spaces in it")).toBeNull();
  });

  it("builds links without a double slash", () => {
    expect(shareUrl("https://a.dev/", "Ab3_x-9Kq2")).toBe("https://a.dev/join/Ab3_x-9Kq2");
  });
});
