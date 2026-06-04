import { describe, expect, it } from "vitest";
import { isValidEmail } from "../lib/validation";

describe("isValidEmail", () => {
  it("accepts well-formed addresses", () => {
    expect(isValidEmail("jane@example.com")).toBe(true);
    expect(isValidEmail("  jane.doe+tag@sub.example.co  ")).toBe(true);
  });

  it("rejects malformed or empty input", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("jane@")).toBe(false);
    expect(isValidEmail("jane@example")).toBe(false);
    expect(isValidEmail("jane @example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});
