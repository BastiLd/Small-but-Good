import { describe, expect, it } from "vitest";
import {
  buildCardImageStyle,
  DEFAULT_CARD_IMAGE_SCALE,
  DEFAULT_EXTERNAL_BUTTON_LABEL,
  normalizeCardImageScale,
  normalizeProjectSections,
  resolveExternalButtonLabel,
  serializeProjectSections
} from "../lib/project-content";

describe("normalizeCardImageScale", () => {
  it("defaults invalid values and clamps to [1, 2.4]", () => {
    expect(normalizeCardImageScale(undefined)).toBe(DEFAULT_CARD_IMAGE_SCALE);
    expect(normalizeCardImageScale("nope")).toBe(1);
    expect(normalizeCardImageScale(0.2)).toBe(1);
    expect(normalizeCardImageScale(5)).toBe(2.4);
    expect(normalizeCardImageScale(1.234)).toBe(1.23);
  });
});

describe("buildCardImageStyle", () => {
  it("produces a centered scale transform", () => {
    expect(buildCardImageStyle(1.5)).toEqual({
      transform: "scale(1.5)",
      transformOrigin: "center center"
    });
  });
});

describe("resolveExternalButtonLabel", () => {
  it("trims a custom label or falls back to the default", () => {
    expect(resolveExternalButtonLabel("  Open  ")).toBe("Open");
    expect(resolveExternalButtonLabel("")).toBe(DEFAULT_EXTERNAL_BUTTON_LABEL);
    expect(resolveExternalButtonLabel(null)).toBe(DEFAULT_EXTERNAL_BUTTON_LABEL);
  });
});

describe("normalizeProjectSections", () => {
  it("parses a JSON string and normalizes fields", () => {
    const sections = normalizeProjectSections('[{"heading":" H ","text":" T "}]');
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("H");
    expect(sections[0].text).toBe("T");
  });

  it("returns an empty array for invalid JSON or non-arrays", () => {
    expect(normalizeProjectSections("{not json")).toEqual([]);
    expect(normalizeProjectSections(42)).toEqual([]);
  });
});

describe("serializeProjectSections", () => {
  it("drops empty sections", () => {
    const out = serializeProjectSections([
      { heading: "", text: "", imageUrl: "" },
      { heading: "Keep", text: "" }
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].heading).toBe("Keep");
  });
});
