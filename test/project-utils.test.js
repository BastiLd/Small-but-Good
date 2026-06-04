import { describe, expect, it } from "vitest";
import {
  appRowToApp,
  buildSubmissionSlug,
  mergeFeedProjects,
  slugify,
  submissionToApp
} from "../lib/project-utils";

describe("slugify", () => {
  it("lowercases, strips diacritics and collapses separators", () => {
    expect(slugify("Mein Tolles Projekt")).toBe("mein-tolles-projekt");
    // NFD splits accented vowels (ü -> u) but not the eszett, which is just
    // dropped as a non-alphanumeric — uniqueness is preserved by the id suffix.
    expect(slugify("Über Größe!")).toBe("uber-gro-e");
  });

  it("trims leading/trailing dashes and caps length", () => {
    expect(slugify("  --Hallo--  ")).toBe("hallo");
    expect(slugify("a".repeat(100)).length).toBe(60);
  });

  it("returns empty string for empty/nullish input", () => {
    expect(slugify("")).toBe("");
    expect(slugify(null)).toBe("");
  });
});

describe("buildSubmissionSlug", () => {
  it("prefers an explicit public_slug", () => {
    expect(buildSubmissionSlug({ public_slug: "custom", project_name: "X" })).toBe("custom");
  });

  it("derives a slug from the name plus an id suffix", () => {
    expect(buildSubmissionSlug({ project_name: "Cool App", id: "abcd1234efgh" })).toBe(
      "cool-app-abcd1234"
    );
  });

  it("falls back to 'projekt' when the name is empty", () => {
    expect(buildSubmissionSlug({ id: "zz" })).toBe("projekt-zz");
  });
});

describe("submissionToApp", () => {
  const row = {
    id: "row-1",
    project_name: "Cool App",
    description: "A neat little app",
    website_url: "https://cool.app",
    card_image_url: "https://cool.app/card.png",
    slug: "cool-app",
    creator_slug: "jane",
    creator_display_name: "Jane Doe"
  };

  it("maps DB columns onto the display model", () => {
    const app = submissionToApp(row);
    expect(app.title).toBe("Cool App");
    expect(app.source).toBe("submission");
    expect(app.itemSource).toBe("submission");
    expect(app.detailPath).toBe("/projekte/cool-app");
    expect(app.store_url).toBe("https://cool.app");
    expect(app.screenshots).toEqual(["https://cool.app/card.png"]);
    expect(app.creatorSlug).toBe("jane");
    expect(app.creatorDisplayName).toBe("Jane Doe");
  });

  it("falls back to a placeholder image and default description", () => {
    const app = submissionToApp({ id: "row-2", project_name: "Bare", slug: "bare" });
    expect(app.screenshots[0]).toContain("project-placeholder.svg");
    expect(app.longDescription).toBe("Community-Projekt");
  });
});

describe("appRowToApp", () => {
  it("builds an /app/<slug> detail path and resolves the creator", () => {
    const app = appRowToApp({
      id: "uuid-1",
      slug: "nexus",
      name: "Nexus",
      short_description: "short",
      website_url: "https://nexus.io",
      creators: { slug: "bk", display_name: "BK" }
    });
    expect(app.detailPath).toBe("/app/nexus");
    expect(app.runtimeId).toBe("nexus");
    expect(app.source).toBe("app");
    expect(app.creatorSlug).toBe("bk");
    expect(app.creatorDisplayName).toBe("BK");
  });
});

describe("mergeFeedProjects", () => {
  it("orders local apps by feedOrder, then community by recency", () => {
    const local = [
      { id: "a", title: "A", feedOrder: 20 },
      { id: "b", title: "B", feedOrder: 10 }
    ];
    const community = [
      { id: "c", title: "C", publishedAt: "2026-01-01" },
      { id: "d", title: "D", publishedAt: "2026-03-01" }
    ];
    const merged = mergeFeedProjects(local, community);
    expect(merged.map((p) => p.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("does not mutate the input arrays", () => {
    const local = [{ id: "a", feedOrder: 2 }, { id: "b", feedOrder: 1 }];
    mergeFeedProjects(local, []);
    expect(local.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
