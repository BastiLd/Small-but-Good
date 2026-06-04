import { afterEach, describe, expect, it, vi } from "vitest";
import { stripBasePath, withBasePath } from "../lib/basePath";

describe("withBasePath (no basePath)", () => {
  it("returns empty string for falsy input", () => {
    expect(withBasePath("")).toBe("");
    expect(withBasePath(null)).toBe("");
  });

  it("leaves absolute/data/blob URLs untouched", () => {
    expect(withBasePath("https://example.com/x.png")).toBe("https://example.com/x.png");
    expect(withBasePath("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(withBasePath("blob:abc")).toBe("blob:abc");
  });

  it("ensures a single leading slash", () => {
    expect(withBasePath("images/logo.png")).toBe("/images/logo.png");
    expect(withBasePath("/images/logo.png")).toBe("/images/logo.png");
  });
});

describe("stripBasePath (no basePath)", () => {
  it("normalizes to a clean app-relative path", () => {
    expect(stripBasePath("/projekte/my-slug/")).toBe("/projekte/my-slug");
    expect(stripBasePath("/projekte/my-slug")).toBe("/projekte/my-slug");
  });

  it("keeps the root path intact", () => {
    expect(stripBasePath("/")).toBe("/");
    expect(stripBasePath("")).toBe("/");
  });

  it("adds a leading slash when missing", () => {
    expect(stripBasePath("app/foo")).toBe("/app/foo");
  });
});

describe("basePath helpers with NEXT_PUBLIC_BASE_PATH set", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("prefixes and strips the configured basePath", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/Small-but-Good");
    vi.resetModules();
    const mod = await import("../lib/basePath.js");

    expect(mod.withBasePath("/images/logo.png")).toBe("/Small-but-Good/images/logo.png");
    expect(mod.stripBasePath("/Small-but-Good/projekte/my-slug/")).toBe("/projekte/my-slug");
    // External URLs still bypass the prefix.
    expect(mod.withBasePath("https://example.com/x")).toBe("https://example.com/x");
  });
});
